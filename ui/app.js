const STELLAR_SDK_URL = "https://esm.sh/@stellar/stellar-sdk";
const FREIGHTER_API_URL = "https://esm.sh/@stellar/freighter-api";

let StellarSdk;
let freighterApi;

const FAIRPICK_ERRORS = {
  1: "AlreadyInitialized: contract đã initialize rồi.",
  2: "NotInitialized: hãy dùng ví admin bấm Initialize trước, hoặc kiểm tra lại Contract ID.",
  3: "InvalidAmount: amount không hợp lệ.",
  4: "SessionNotFound: không tìm thấy Session ID này.",
  5: "NotSessionOwner: ví hiện tại không phải owner của session.",
  6: "AlreadyVerified: session này đã được xác thực rồi.",
  7: "InsufficientRewardPool: reward pool không đủ token, admin cần Fund rewards.",
  8: "MathOverflow: phép tính vượt giới hạn.",
};

const $ = (id) => document.getElementById(id);

const state = {
  wallet: null,
  selectedPlaceId: "place-123",
  placeCatalog: [],
  places: [],
};

const fallbackPlaces = [
  {
    id: "place-123",
    name: "Bếp Nhỏ Pasteur",
    category: "Ăn tối",
    distance: "0.8 km",
    price: "120k/người",
    rating: "4.6",
    tag: "ấm, ít ồn",
    vibe: "hợp nhóm nhỏ",
  },
];

async function ensureStellarSdk() {
  if (!StellarSdk) {
    log("Loading Stellar SDK...");
    const mod = await import(STELLAR_SDK_URL);
    StellarSdk = normalizeStellarSdk(mod);
  }
  return StellarSdk;
}

function normalizeStellarSdk(mod) {
  const candidates = [mod, mod?.default, mod?.default?.default].filter(Boolean);
  for (const candidate of candidates) {
    if (typeof candidate.nativeToScVal === "function" && candidate.xdr) {
      return candidate;
    }
  }
  for (const candidate of candidates) {
    if (candidate.xdr && (candidate.Contract || candidate.rpc)) {
      return candidate;
    }
  }
  return mod;
}

async function ensureFreighterApi() {
  if (!freighterApi) {
    log("Loading Freighter API...");
    const mod = await import(FREIGHTER_API_URL);
    freighterApi = normalizeFreighterApi(mod);
    log("Freighter API loaded.", {
      functions: Object.keys(freighterApi).filter(
        (key) => typeof freighterApi[key] === "function",
      ),
    });
  }
  return freighterApi;
}

function normalizeFreighterApi(mod) {
  const candidates = [
    mod,
    mod?.default,
    mod?.default?.default,
    globalThis.freighterApi,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (
      typeof candidate.isConnected === "function" ||
      typeof candidate.requestAccess === "function" ||
      typeof candidate.getAddress === "function" ||
      typeof candidate.signTransaction === "function"
    ) {
      return candidate;
    }
  }

  throw new Error(
    `Freighter API loaded but no supported functions were found. Exports: ${Object.keys(
      mod || {},
    ).join(", ")}`,
  );
}

function requireFreighterFn(api, names) {
  for (const name of names) {
    if (typeof api[name] === "function") return api[name].bind(api);
  }
  throw new Error(`Freighter API missing function: ${names.join(" or ")}`);
}

function log(message, payload) {
  const line =
    payload === undefined
      ? message
      : `${message}\n${JSON.stringify(payload, stringifyBigInt, 2)}`;
  $("outputLog").textContent = `${new Date().toLocaleTimeString()}  ${line}\n\n${
    $("outputLog").textContent
  }`;
}

function stringifyBigInt(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}

function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function unwrapFreighter(value, keys) {
  if (typeof value === "string" || typeof value === "boolean") return value;
  for (const key of keys) {
    if (value && value[key] !== undefined) return value[key];
  }
  return value;
}

function explainContractError(message) {
  const match = String(message).match(/Error\(Contract,\s*#(\d+)\)/);
  if (!match) return "";
  const code = Number(match[1]);
  return FAIRPICK_ERRORS[code] ? `\nFairPick error #${code}: ${FAIRPICK_ERRORS[code]}` : "";
}

async function connectWallet() {
  const freighter = await ensureFreighterApi();
  if (typeof freighter.isConnected === "function") {
    const connected = unwrapFreighter(await freighter.isConnected(), ["isConnected"]);
    if (!connected) {
      throw new Error("Freighter extension is not installed or not connected.");
    }
  }

  let publicKey;
  if (typeof freighter.requestAccess === "function") {
    const access = await freighter.requestAccess();
    publicKey = unwrapFreighter(access, ["address", "publicKey"]);
  } else {
    if (typeof freighter.isAllowed === "function") {
      const allowed = unwrapFreighter(await freighter.isAllowed(), ["isAllowed"]);
      if (!allowed) {
        const allow = requireFreighterFn(freighter, ["setAllowed"]);
        await allow();
      }
    }

    const getAddress = requireFreighterFn(freighter, ["getAddress", "getPublicKey"]);
    publicKey = unwrapFreighter(await getAddress(), ["address", "publicKey"]);
  }

  if (!publicKey || typeof publicKey !== "string") {
    throw new Error("Freighter did not return a public address.");
  }

  let network = "Unknown network";
  if (typeof freighter.getNetwork === "function") {
    network = unwrapFreighter(await freighter.getNetwork(), [
      "network",
      "networkPassphrase",
    ]);
  } else if (typeof freighter.getNetworkDetails === "function") {
    network = unwrapFreighter(await freighter.getNetworkDetails(), [
      "network",
      "networkPassphrase",
    ]);
  }

  state.wallet = publicKey;
  $("userAddress").value = publicKey;
  $("walletStatus").textContent = `${shortAddress(publicKey)} · ${network}`;
  log("Wallet connected", { publicKey, network });
}

function getRpc() {
  return new StellarSdk.rpc.Server($("rpcUrl").value.trim());
}

function getContract() {
  const contractId = $("contractId").value.trim();
  if (!contractId) throw new Error("Missing Contract ID.");
  return new StellarSdk.Contract(contractId);
}

function addressArg(value) {
  if (!value) throw new Error("Missing address argument.");
  return StellarSdk.Address.fromString(value).toScVal();
}

function stringArg(value) {
  if (typeof StellarSdk.nativeToScVal === "function") {
    return StellarSdk.nativeToScVal(value, { type: "string" });
  }
  return StellarSdk.xdr.ScVal.scvString(value);
}

function u64Arg(value) {
  if (typeof StellarSdk.nativeToScVal === "function") {
    return StellarSdk.nativeToScVal(BigInt(value), { type: "u64" });
  }
  if (StellarSdk.UnsignedHyper?.fromString) {
    return StellarSdk.xdr.ScVal.scvU64(
      StellarSdk.UnsignedHyper.fromString(String(value)),
    );
  }
  throw new Error("Stellar SDK does not expose nativeToScVal or UnsignedHyper.");
}

function i128Arg(value) {
  if (typeof StellarSdk.nativeToScVal === "function") {
    return StellarSdk.nativeToScVal(BigInt(value), { type: "i128" });
  }
  return i128ScVal(BigInt(value));
}

function i128ScVal(value) {
  const negative = value < 0n;
  let abs = negative ? -value : value;
  const max = 1n << 128n;
  if (negative) abs = max - abs;
  const hi = (abs >> 64n) & ((1n << 64n) - 1n);
  const lo = abs & ((1n << 64n) - 1n);
  return StellarSdk.xdr.ScVal.scvI128(
    new StellarSdk.xdr.Int128Parts({
      hi: StellarSdk.Hyper.fromString(hi.toString()),
      lo: StellarSdk.UnsignedHyper.fromString(lo.toString()),
    }),
  );
}

function bytesN32Arg(hex) {
  const clean = hex.replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error("Hash must be 32 bytes encoded as 64 hex characters.");
  }
  return StellarSdk.xdr.ScVal.scvBytes(Uint8Array.from(hexToBytes(clean)));
}

function hexToBytes(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function currentCriteria() {
  return {
    need: $("need").value,
    category: $("category").value,
    budget: $("budget").value,
    area: $("area").value,
  };
}

function parseBudget(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function placePrice(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return 0;
  const amount = Number(digits);
  return amount < 1000 ? amount * 1000 : amount;
}

function scorePlace(place, criteria) {
  const wish = criteria.need.toLowerCase();
  let score = 0;
  const reasons = [];

  if (place.category === criteria.category) {
    score += 4;
    reasons.push(`đúng loại ${criteria.category.toLowerCase()}`);
  }

  const budget = parseBudget(criteria.budget);
  const price = placePrice(place.price);
  if (budget > 0 && price <= budget) {
    score += 3;
    reasons.push("nằm trong ngân sách");
  }

  for (const word of ["yên", "không quá ồn", "nhóm", "healthy", "mở muộn"]) {
    if (
      wish.includes(word) &&
      `${place.tag} ${place.vibe}`.toLowerCase().includes(word)
    ) {
      score += 2;
      reasons.push(`khớp "${word}"`);
    }
  }

  score += Math.round(Number(place.rating) * 10) / 10;
  return {
    ...place,
    score,
    reason: reasons.length ? reasons.join(", ") : "rating tốt và gần khu vực",
  };
}

async function refreshHashes() {
  const shortlist = JSON.stringify(state.places);
  const criteria = JSON.stringify(currentCriteria());
  $("shortlistHash").textContent = await sha256Hex(shortlist);
  $("criteriaHash").textContent = await sha256Hex(criteria);
}

function renderPlaces() {
  const root = $("places");
  root.textContent = "";
  for (const place of state.places) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "place";
    button.setAttribute("aria-selected", String(place.id === state.selectedPlaceId));
    button.innerHTML = `
      <strong>${place.name}</strong>
      <span>${place.distance} · ${place.price}</span>
      <span>${place.category} · Rating ${place.rating}</span>
      <span>${place.tag}</span>
      <span>ID: ${place.id}</span>
      <em>${place.reason}</em>
    `;
    button.addEventListener("click", async () => {
      state.selectedPlaceId = place.id;
      $("selectedPlace").value = place.id;
      updateSuggestionSummary(place);
      renderPlaces();
      await refreshHashes();
    });
    root.appendChild(button);
  }
}

async function generateShortlist() {
  const criteria = currentCriteria();
  if (state.placeCatalog.length === 0) {
    await loadPlaces();
  }
  state.places = state.placeCatalog
    .map((place) => scorePlace(place, criteria))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((place, index) => ({
      ...place,
      rank: index + 1,
      criteria,
    }));
  state.selectedPlaceId = state.places[0].id;
  $("selectedPlace").value = state.selectedPlaceId;
  renderPlaces();
  updateSuggestionSummary(state.places[0]);
  await refreshHashes();
  log("Generated shortlist and hashes.", {
    selectedPlaceId: state.selectedPlaceId,
    suggestion: state.places[0].name,
    reason: state.places[0].reason,
    shortlistHash: $("shortlistHash").textContent,
    criteriaHash: $("criteriaHash").textContent,
  });
}

async function loadPlaces() {
  try {
    const response = await fetch("./places.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const places = await response.json();
    if (!Array.isArray(places) || places.length === 0) {
      throw new Error("places.json must contain a non-empty array.");
    }
    state.placeCatalog = places;
    log("Loaded place catalog.", { source: "ui/places.json", count: places.length });
  } catch (error) {
    state.placeCatalog = fallbackPlaces;
    log(`Could not load places.json, using fallback places. ${error.message || error}`);
  }
}

function updateSuggestionSummary(place) {
  $("suggestionSummary").innerHTML = `<strong>${place.name}</strong> được chọn vì ${place.reason}. ID sẽ ghi vào contract: <code>${place.id}</code>`;
}

async function hashProof() {
  $("checkinHash").textContent = await sha256Hex($("checkinProof").value);
  $("reviewHash").textContent = await sha256Hex($("reviewText").value);
  log("Generated check-in and review hashes.", {
    checkinHash: $("checkinHash").textContent,
    reviewHash: $("reviewHash").textContent,
  });
}

async function buildInvocation(source, method, args) {
  await ensureStellarSdk();
  const rpc = getRpc();
  const account = await rpc.getAccount(source);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: $("networkPassphrase").value,
  })
    .addOperation(getContract().call(method, ...args))
    .setTimeout(180)
    .build();

  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    const detail = explainContractError(simulation.error);
    throw new Error(`Simulation failed: ${simulation.error}${detail}`);
  }

  return StellarSdk.rpc.assembleTransaction(tx, simulation).build();
}

async function signAndSubmit(tx) {
  await ensureStellarSdk();
  const freighter = await ensureFreighterApi();
  const networkPassphrase = $("networkPassphrase").value;
  const sign = requireFreighterFn(freighter, ["signTransaction"]);
  const signed = await sign(tx.toXDR(), { networkPassphrase });
  const signedXdr = unwrapFreighter(signed, ["signedTxXdr", "signedXDR"]);
  const signedTx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    networkPassphrase,
  );

  const rpc = getRpc();
  const sent = await rpc.sendTransaction(signedTx);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction failed: ${sent.errorResult}`);
  }

  log("Transaction submitted.", { hash: sent.hash, status: sent.status });

  let result = await rpc.getTransaction(sent.hash);
  while (result.status === "NOT_FOUND") {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    result = await rpc.getTransaction(sent.hash);
  }

  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction status: ${result.status}`);
  }

  const returnValue = result.returnValue
    ? StellarSdk.scValToNative(result.returnValue)
    : null;
  log("Transaction confirmed.", { hash: sent.hash, returnValue });
  return returnValue;
}

async function simulateRead(method, args = []) {
  await ensureStellarSdk();
  const source = $("userAddress").value.trim() || state.wallet;
  if (!source) throw new Error("Connect wallet or enter a source user address.");
  const tx = await buildInvocation(source, method, args);
  const rpc = getRpc();
  const simulation = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Read simulation failed: ${simulation.error}`);
  }
  const value = simulation.result?.retval
    ? StellarSdk.scValToNative(simulation.result.retval)
    : null;
  log(`Read ${method}.`, value);
}

async function createSession() {
  await ensureStellarSdk();
  const source = $("userAddress").value.trim() || state.wallet;
  if (!source) throw new Error("Connect wallet or enter user address.");
  if ($("shortlistHash").textContent === "-") await generateShortlist();

  const tx = await buildInvocation(source, "create_session", [
    addressArg(source),
    bytesN32Arg($("shortlistHash").textContent),
    bytesN32Arg($("criteriaHash").textContent),
    stringArg(state.selectedPlaceId),
  ]);
  const sessionId = await signAndSubmit(tx);
  if (sessionId) $("sessionId").value = sessionId.toString();
}

async function initializeContract() {
  await ensureStellarSdk();
  const source = $("userAddress").value.trim() || state.wallet;
  if (!source) throw new Error("Connect admin wallet or enter admin address.");
  if (!$("verifierAddress").value.trim()) throw new Error("Missing verifier address.");
  if (!$("paymentToken").value.trim()) throw new Error("Missing payment token contract.");

  const tx = await buildInvocation(source, "initialize", [
    addressArg(source),
    addressArg($("verifierAddress").value.trim()),
    addressArg($("paymentToken").value.trim()),
    i128Arg($("sessionFee").value),
    i128Arg($("rewardAmount").value),
    i128Arg($("pickReward").value),
  ]);
  await signAndSubmit(tx);
}

async function fundRewards() {
  await ensureStellarSdk();
  const source = $("userAddress").value.trim() || state.wallet;
  if (!source) throw new Error("Connect admin wallet or enter admin address.");

  const tx = await buildInvocation(source, "fund_rewards", [
    addressArg(source),
    i128Arg($("fundAmount").value),
  ]);
  await signAndSubmit(tx);
}

async function confirmCheckin() {
  await ensureStellarSdk();
  const source = $("userAddress").value.trim() || state.wallet;
  const sessionId = $("sessionId").value;
  if (!source) throw new Error("Connect verifier wallet or enter verifier address.");
  if (!sessionId) throw new Error("Missing Session ID.");
  if ($("checkinHash").textContent === "-") await hashProof();

  const tx = await buildInvocation(source, "confirm_checkin", [
    u64Arg(sessionId),
    bytesN32Arg($("checkinHash").textContent),
    bytesN32Arg($("reviewHash").textContent),
  ]);
  await signAndSubmit(tx);
}

async function withBusy(button, action) {
  button.disabled = true;
  try {
    await action();
  } catch (error) {
    log(`Error: ${error.message || error}`);
  } finally {
    button.disabled = false;
  }
}

function bind() {
  window.addEventListener("error", (event) => {
    log(`Browser error: ${event.message}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason?.message || event.reason || "Unknown promise error";
    log(`Browser async error: ${reason}`);
  });

  $("connectWallet").addEventListener("click", () =>
    withBusy($("connectWallet"), connectWallet),
  );
  $("generateShortlist").addEventListener("click", () =>
    withBusy($("generateShortlist"), generateShortlist),
  );
  $("hashReview").addEventListener("click", () =>
    withBusy($("hashReview"), hashProof),
  );
  $("createSession").addEventListener("click", () =>
    withBusy($("createSession"), createSession),
  );
  $("initializeContract").addEventListener("click", () =>
    withBusy($("initializeContract"), initializeContract),
  );
  $("fundRewards").addEventListener("click", () =>
    withBusy($("fundRewards"), fundRewards),
  );
  $("confirmCheckin").addEventListener("click", () =>
    withBusy($("confirmCheckin"), confirmCheckin),
  );
  $("loadConfig").addEventListener("click", () =>
    withBusy($("loadConfig"), () => simulateRead("config")),
  );
  $("loadSession").addEventListener("click", () =>
    withBusy($("loadSession"), async () => {
      await ensureStellarSdk();
      const sessionId = $("sessionId").value;
      if (!sessionId) throw new Error("Missing Session ID.");
      return simulateRead("get_session", [u64Arg(sessionId)]);
    }),
  );

  for (const id of ["need", "category", "budget", "area"]) {
    $(id).addEventListener("input", refreshHashes);
  }
}

bind();
loadPlaces()
  .then(generateShortlist)
  .catch((error) => log(`Startup error: ${error.message || error}`));
