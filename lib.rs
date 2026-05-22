#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contractmeta, contracttype, symbol_short, token,
    Address, BytesN, Env, String,
};

contractmeta!(key = "name", val = "FairPick");
contractmeta!(key = "version", val = "0.1.0");
contractmeta!(
    key = "desc",
    val = "Decision sessions and verified visit rewards"
);

const DAY_IN_LEDGERS: u32 = 17_280;
const INSTANCE_TTL: u32 = 30 * DAY_IN_LEDGERS;
const INSTANCE_THRESHOLD: u32 = 29 * DAY_IN_LEDGERS;
const SESSION_TTL: u32 = 90 * DAY_IN_LEDGERS;
const SESSION_THRESHOLD: u32 = 89 * DAY_IN_LEDGERS;
const PICK_TTL: u32 = 365 * DAY_IN_LEDGERS;
const PICK_THRESHOLD: u32 = 364 * DAY_IN_LEDGERS;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Verifier,
    PaymentToken,
    SessionFee,
    RewardAmount,
    PickReward,
    RewardPool,
    SessionCount,
    Session(u64),
    PickBalance(Address),
    VerifiedVisits(Address),
    Initialized,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SessionStatus {
    Created,
    Verified,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DecisionSession {
    pub id: u64,
    pub user: Address,
    pub shortlist_hash: BytesN<32>,
    pub criteria_hash: BytesN<32>,
    pub selected_place_id: String,
    pub checkin_proof_hash: BytesN<32>,
    pub review_hash: BytesN<32>,
    pub status: SessionStatus,
    pub deposit_amount: i128,
    pub reward_amount: i128,
    pub pick_reward: i128,
    pub created_at: u64,
    pub verified_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FairPickConfig {
    pub admin: Address,
    pub verifier: Address,
    pub payment_token: Address,
    pub session_fee: i128,
    pub reward_amount: i128,
    pub pick_reward: i128,
    pub reward_pool: i128,
    pub session_count: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FairPickError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    SessionNotFound = 4,
    NotSessionOwner = 5,
    AlreadyVerified = 6,
    InsufficientRewardPool = 7,
    MathOverflow = 8,
}

#[contract]
pub struct FairPickContract;

#[contractimpl]
impl FairPickContract {
    pub fn initialize(
        env: Env,
        admin: Address,
        verifier: Address,
        payment_token: Address,
        session_fee: i128,
        reward_amount: i128,
        pick_reward: i128,
    ) -> Result<(), FairPickError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(FairPickError::AlreadyInitialized);
        }
        if session_fee < 0 || reward_amount < 0 || pick_reward < 0 {
            return Err(FairPickError::InvalidAmount);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Verifier, &verifier);
        env.storage()
            .instance()
            .set(&DataKey::PaymentToken, &payment_token);
        env.storage()
            .instance()
            .set(&DataKey::SessionFee, &session_fee);
        env.storage()
            .instance()
            .set(&DataKey::RewardAmount, &reward_amount);
        env.storage()
            .instance()
            .set(&DataKey::PickReward, &pick_reward);
        env.storage().instance().set(&DataKey::RewardPool, &0_i128);
        env.storage().instance().set(&DataKey::SessionCount, &0_u64);
        env.storage().instance().set(&DataKey::Initialized, &true);
        extend_instance_ttl(&env);

        Ok(())
    }

    pub fn fund_rewards(env: Env, from: Address, amount: i128) -> Result<(), FairPickError> {
        require_initialized(&env)?;
        if amount <= 0 {
            return Err(FairPickError::InvalidAmount);
        }

        from.require_auth();
        let token_addr = get_payment_token(&env)?;
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        let pool = get_reward_pool(&env)?;
        let new_pool = pool
            .checked_add(amount)
            .ok_or(FairPickError::MathOverflow)?;
        env.storage()
            .instance()
            .set(&DataKey::RewardPool, &new_pool);
        extend_instance_ttl(&env);
        env.events()
            .publish((symbol_short!("funded"), from), new_pool);

        Ok(())
    }

    pub fn create_session(
        env: Env,
        user: Address,
        shortlist_hash: BytesN<32>,
        criteria_hash: BytesN<32>,
        selected_place_id: String,
    ) -> Result<u64, FairPickError> {
        require_initialized(&env)?;
        user.require_auth();

        let session_fee = get_i128(&env, DataKey::SessionFee)?;
        if session_fee > 0 {
            let token_addr = get_payment_token(&env)?;
            let token_client = token::Client::new(&env, &token_addr);
            token_client.transfer(&user, &env.current_contract_address(), &session_fee);

            let pool = get_reward_pool(&env)?;
            let new_pool = pool
                .checked_add(session_fee)
                .ok_or(FairPickError::MathOverflow)?;
            env.storage()
                .instance()
                .set(&DataKey::RewardPool, &new_pool);
        }

        let id = get_session_count(&env)?
            .checked_add(1)
            .ok_or(FairPickError::MathOverflow)?;
        let zero_hash = BytesN::from_array(&env, &[0; 32]);
        let session = DecisionSession {
            id,
            user: user.clone(),
            shortlist_hash,
            criteria_hash,
            selected_place_id,
            checkin_proof_hash: zero_hash.clone(),
            review_hash: zero_hash,
            status: SessionStatus::Created,
            deposit_amount: session_fee,
            reward_amount: 0,
            pick_reward: 0,
            created_at: env.ledger().timestamp(),
            verified_at: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Session(id), &session);
        env.storage().instance().set(&DataKey::SessionCount, &id);
        extend_instance_ttl(&env);
        extend_session_ttl(&env, id);
        env.events().publish((symbol_short!("created"), id), user);

        Ok(id)
    }

    pub fn confirm_checkin(
        env: Env,
        session_id: u64,
        checkin_proof_hash: BytesN<32>,
        review_hash: BytesN<32>,
    ) -> Result<(), FairPickError> {
        require_initialized(&env)?;
        let verifier: Address = env
            .storage()
            .instance()
            .get(&DataKey::Verifier)
            .ok_or(FairPickError::NotInitialized)?;
        verifier.require_auth();

        let mut session = get_session_or_err(&env, session_id)?;
        if session.status == SessionStatus::Verified {
            return Err(FairPickError::AlreadyVerified);
        }

        let reward_amount = get_i128(&env, DataKey::RewardAmount)?;
        let pick_reward = get_i128(&env, DataKey::PickReward)?;
        let pool = get_reward_pool(&env)?;
        if pool < reward_amount {
            return Err(FairPickError::InsufficientRewardPool);
        }

        session.status = SessionStatus::Verified;
        session.checkin_proof_hash = checkin_proof_hash;
        session.review_hash = review_hash;
        session.reward_amount = reward_amount;
        session.pick_reward = pick_reward;
        session.verified_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Session(session_id), &session);
        extend_session_ttl(&env, session_id);

        if reward_amount > 0 {
            let token_addr = get_payment_token(&env)?;
            let token_client = token::Client::new(&env, &token_addr);
            token_client.transfer(
                &env.current_contract_address(),
                &session.user,
                &reward_amount,
            );
        }

        env.storage()
            .instance()
            .set(&DataKey::RewardPool, &(pool - reward_amount));
        add_pick_reward(&env, session.user.clone(), pick_reward)?;
        add_verified_visit(&env, session.user.clone())?;
        extend_instance_ttl(&env);
        env.events()
            .publish((symbol_short!("verified"), session_id), session.user);

        Ok(())
    }

    pub fn set_verifier(env: Env, new_verifier: Address) -> Result<(), FairPickError> {
        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::Verifier, &new_verifier);
        extend_instance_ttl(&env);
        Ok(())
    }

    pub fn set_economics(
        env: Env,
        session_fee: i128,
        reward_amount: i128,
        pick_reward: i128,
    ) -> Result<(), FairPickError> {
        if session_fee < 0 || reward_amount < 0 || pick_reward < 0 {
            return Err(FairPickError::InvalidAmount);
        }

        let admin = require_admin(&env)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::SessionFee, &session_fee);
        env.storage()
            .instance()
            .set(&DataKey::RewardAmount, &reward_amount);
        env.storage()
            .instance()
            .set(&DataKey::PickReward, &pick_reward);
        extend_instance_ttl(&env);
        Ok(())
    }

    pub fn get_session(env: Env, session_id: u64) -> Result<DecisionSession, FairPickError> {
        get_session_or_err(&env, session_id)
    }

    pub fn is_verified_visit(env: Env, session_id: u64) -> bool {
        match get_session_or_err(&env, session_id) {
            Ok(session) => session.status == SessionStatus::Verified,
            Err(_) => false,
        }
    }

    pub fn pick_balance(env: Env, user: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::PickBalance(user))
            .unwrap_or(0)
    }

    pub fn verified_visits(env: Env, user: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::VerifiedVisits(user))
            .unwrap_or(0)
    }

    pub fn config(env: Env) -> Result<FairPickConfig, FairPickError> {
        Ok(FairPickConfig {
            admin: env
                .storage()
                .instance()
                .get(&DataKey::Admin)
                .ok_or(FairPickError::NotInitialized)?,
            verifier: env
                .storage()
                .instance()
                .get(&DataKey::Verifier)
                .ok_or(FairPickError::NotInitialized)?,
            payment_token: get_payment_token(&env)?,
            session_fee: get_i128(&env, DataKey::SessionFee)?,
            reward_amount: get_i128(&env, DataKey::RewardAmount)?,
            pick_reward: get_i128(&env, DataKey::PickReward)?,
            reward_pool: get_reward_pool(&env)?,
            session_count: get_session_count(&env)?,
        })
    }
}

fn require_initialized(env: &Env) -> Result<(), FairPickError> {
    if !env.storage().instance().has(&DataKey::Initialized) {
        return Err(FairPickError::NotInitialized);
    }
    Ok(())
}

fn require_admin(env: &Env) -> Result<Address, FairPickError> {
    require_initialized(env)?;
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(FairPickError::NotInitialized)
}

fn get_payment_token(env: &Env) -> Result<Address, FairPickError> {
    env.storage()
        .instance()
        .get(&DataKey::PaymentToken)
        .ok_or(FairPickError::NotInitialized)
}

fn get_i128(env: &Env, key: DataKey) -> Result<i128, FairPickError> {
    env.storage()
        .instance()
        .get(&key)
        .ok_or(FairPickError::NotInitialized)
}

fn get_reward_pool(env: &Env) -> Result<i128, FairPickError> {
    get_i128(env, DataKey::RewardPool)
}

fn get_session_count(env: &Env) -> Result<u64, FairPickError> {
    env.storage()
        .instance()
        .get(&DataKey::SessionCount)
        .ok_or(FairPickError::NotInitialized)
}

fn get_session_or_err(env: &Env, session_id: u64) -> Result<DecisionSession, FairPickError> {
    env.storage()
        .persistent()
        .get(&DataKey::Session(session_id))
        .ok_or(FairPickError::SessionNotFound)
}

fn add_pick_reward(env: &Env, user: Address, amount: i128) -> Result<(), FairPickError> {
    if amount == 0 {
        return Ok(());
    }

    let key = DataKey::PickBalance(user);
    let current = env.storage().persistent().get(&key).unwrap_or(0_i128);
    let next = current
        .checked_add(amount)
        .ok_or(FairPickError::MathOverflow)?;
    env.storage().persistent().set(&key, &next);
    env.storage()
        .persistent()
        .extend_ttl(&key, PICK_THRESHOLD, PICK_TTL);
    Ok(())
}

fn add_verified_visit(env: &Env, user: Address) -> Result<(), FairPickError> {
    let key = DataKey::VerifiedVisits(user);
    let current = env.storage().persistent().get(&key).unwrap_or(0_u64);
    let next = current.checked_add(1).ok_or(FairPickError::MathOverflow)?;
    env.storage().persistent().set(&key, &next);
    env.storage()
        .persistent()
        .extend_ttl(&key, PICK_THRESHOLD, PICK_TTL);
    Ok(())
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_THRESHOLD, INSTANCE_TTL);
}

fn extend_session_ttl(env: &Env, session_id: u64) {
    env.storage().persistent().extend_ttl(
        &DataKey::Session(session_id),
        SESSION_THRESHOLD,
        SESSION_TTL,
    );
}

#[cfg(test)]
mod test {
    extern crate std;

    use super::*;
    use soroban_sdk::{testutils::Address as _, token, Env};

    fn hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup() -> (
        Env,
        FairPickContractClient<'static>,
        token::Client<'static>,
        Address,
        Address,
        Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::Client::new(&env, &sac.address());
        let token_admin_client = token::StellarAssetClient::new(&env, &sac.address());

        let admin = Address::generate(&env);
        let verifier = Address::generate(&env);
        let user = Address::generate(&env);
        token_admin_client.mint(&admin, &1_000);
        token_admin_client.mint(&user, &100);

        let contract_id = env.register(FairPickContract, ());
        let client = FairPickContractClient::new(&env, &contract_id);
        client.initialize(&admin, &verifier, &sac.address(), &10, &3, &5);

        (env, client, token_client, admin, verifier, user)
    }

    #[test]
    fn test_create_and_confirm_verified_visit() {
        let (env, client, token_client, admin, _verifier, user) = setup();

        client.fund_rewards(&admin, &50);
        let session_id = client.create_session(
            &user,
            &hash(&env, 1),
            &hash(&env, 2),
            &String::from_str(&env, "place-123"),
        );

        assert_eq!(session_id, 1);
        assert_eq!(token_client.balance(&user), 90);
        assert_eq!(client.config().reward_pool, 60);

        client.confirm_checkin(&session_id, &hash(&env, 3), &hash(&env, 4));

        let session = client.get_session(&session_id);
        assert_eq!(session.status, SessionStatus::Verified);
        assert_eq!(session.reward_amount, 3);
        assert_eq!(session.pick_reward, 5);
        assert_eq!(client.is_verified_visit(&session_id), true);
        assert_eq!(client.pick_balance(&user), 5);
        assert_eq!(client.verified_visits(&user), 1);
        assert_eq!(token_client.balance(&user), 93);
        assert_eq!(client.config().reward_pool, 57);
    }

    #[test]
    fn test_double_checkin_is_rejected() {
        let (env, client, _token_client, admin, _verifier, user) = setup();

        client.fund_rewards(&admin, &50);
        let session_id = client.create_session(
            &user,
            &hash(&env, 1),
            &hash(&env, 2),
            &String::from_str(&env, "place-abc"),
        );

        client.confirm_checkin(&session_id, &hash(&env, 3), &hash(&env, 4));
        let result = client.try_confirm_checkin(&session_id, &hash(&env, 5), &hash(&env, 6));

        assert!(result.is_err());
    }

    #[test]
    fn test_admin_can_update_economics() {
        let (_env, client, _token_client, _admin, _verifier, _user) = setup();

        client.set_economics(&20, &7, &11);
        let config = client.config();

        assert_eq!(config.session_fee, 20);
        assert_eq!(config.reward_amount, 7);
        assert_eq!(config.pick_reward, 11);
    }
}
