# FairPick

FairPick là một dApp mẫu trên Stellar/Soroban giúp người dùng tạo một “Decision Session” khi chọn địa điểm ăn uống/đi chơi. Ứng dụng lưu bằng chứng minh bạch lên blockchain dưới dạng hash, xác thực check-in, và thưởng token/reputation cho người dùng có đóng góp thật.

## FairPick Là Gì?

Khi đi chơi, nhóm bạn thường mất thời gian chọn quán. FairPick mô phỏng flow:

1. Người dùng nhập nhu cầu, ví dụ: “Ăn tối gần đây, dưới 150k/người”.
2. App tạo shortlist địa điểm.
3. App hash shortlist và tiêu chí chọn để không lưu dữ liệu nhạy cảm trực tiếp lên blockchain.
4. Người dùng ký giao dịch tạo Decision Session.
5. Sau khi check-in hợp lệ, verifier xác nhận.
6. Contract trả reward token và cộng PICK reputation.

## Các Khái Niệm Cần Biết

**Rust**  
Ngôn ngữ lập trình dùng để viết Soroban smart contract. Bạn không cần biết Rust để chạy app, chỉ cần copy/paste lệnh.

**Stellar**  
Blockchain tập trung vào thanh toán nhanh, phí thấp. Trong app này Stellar dùng để gửi reward token và ghi nhận dữ liệu minh bạch.

**Soroban**  
Nền tảng smart contract của Stellar. File [lib.rs](./lib.rs) là smart contract chính của app.

**Smart contract**  
Code chạy trên blockchain. FairPick contract xử lý session, check-in, reward và PICK reputation.

**Testnet**  
Mạng thử nghiệm của Stellar. Token/XLM trên testnet không có giá trị thật.

**Freighter**  
Ví trình duyệt giống MetaMask nhưng cho Stellar. UI dùng Freighter để ký giao dịch.

**Contract ID**  
Địa chỉ contract sau khi deploy. Nó bắt đầu bằng chữ `C...`. Bạn dán Contract ID vào UI để app biết gọi contract nào.

**SAC / Payment Token Contract**  
Soroban token contract đại diện cho một Stellar asset như USDC hoặc token test. FairPick dùng token contract này để thu session fee và trả reward.

## Cấu Trúc Dự Án

```text
.
├── lib.rs                  # FairPick Soroban smart contract
├── Cargo.toml              # Cấu hình Rust/Soroban crate
├── ui/
│   ├── index.html          # Giao diện web
│   ├── styles.css          # CSS
│   ├── app.js              # Logic frontend, Freighter, RPC, hash
│   └── places.json         # Danh sách địa điểm off-chain cho suggestion
├── guide.md                # Hướng dẫn kỹ thuật ngắn
├── prd.md                  # Product requirements
└── README.md               # File bạn đang đọc
```

## Cài Đặt Công Cụ

### 1. Cài Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Sau khi cài xong, mở terminal mới hoặc chạy:

```bash
source "$HOME/.cargo/env"
```

Kiểm tra:

```bash
rustc --version
cargo --version
```

### 2. Cài target build cho smart contract

```bash
rustup target add wasm32-unknown-unknown
rustup target add wasm32v1-none
```

### 3. Cài Stellar CLI

```bash
cargo install --locked stellar-cli
```

Kiểm tra:

```bash
stellar --version
```

### 4. Cài Freighter

1. Vào `https://freighter.app`.
2. Cài extension cho Chrome/Brave/Firefox.
3. Tạo ví.
4. Mở Freighter và chuyển network sang `Testnet`.

## Chạy App Local

### 1. Chạy test contract

```bash
cargo test --locked
```

Nếu thành công, bạn sẽ thấy:

```text
3 passed
```

Test này không cần ví, không cần deploy. Nó chạy contract trong môi trường giả lập.

### 2. Build smart contract

```bash
stellar contract build
```

Kết quả sẽ tạo file:

```text
target/wasm32v1-none/release/fairpick.wasm
```

### 3. Chạy giao diện web

```bash
python3 -m http.server 5174 --bind 127.0.0.1 -d ui
```

Mở browser:

```text
http://127.0.0.1:5174/
```

Nếu port bị chiếm:

```bash
python3 -m http.server 5175 --bind 127.0.0.1 -d ui
```

Rồi mở:

```text
http://127.0.0.1:5175/
```

## Các Tính Năng Trong UI

### Network

Phần này cấu hình app gọi đúng contract và đúng network.

**Contract ID**  
Dán địa chỉ contract đã deploy, bắt đầu bằng `C...`.

**RPC URL**  
Mặc định:

```text
https://soroban-testnet.stellar.org
```

Đây là endpoint để đọc/gửi giao dịch Soroban.

**Network passphrase**  
Mặc định:

```text
Test SDF Network ; September 2015
```

Không sửa nếu bạn dùng Testnet.

**User address**  
Địa chỉ ví người dùng. Khi bấm `Connect Freighter`, app tự điền.

**Session ID**  
ID của Decision Session. Sau khi tạo session thành công, contract trả về ID như `1`, `2`, `3`.

**Load config**  
Đọc cấu hình contract: admin, verifier, token reward, session fee, reward amount, PICK reward.

**Load session**  
Đọc thông tin một session theo Session ID.

### Admin

Phần này dùng cho admin contract.

**Verifier address**  
Địa chỉ ví được quyền xác nhận check-in. Ví này sẽ bấm `Confirm check-in`.

**Payment token contract**  
Contract token dùng để thu phí và trả reward. Đây có thể là SAC của USDC hoặc token test.

**Danh sách địa điểm lấy từ đâu?**  
UI đọc địa điểm từ [ui/places.json](./ui/places.json). File này đóng vai trò backend/data nhỏ cho MVP. Khi bấm `Gợi ý địa điểm`, frontend tải JSON, chấm điểm địa điểm theo mong muốn/ngân sách/category, rồi chỉ gửi `shortlist_hash`, `criteria_hash` và `selected_place_id` lên contract.

**Session fee**  
Số token user gửi vào contract khi tạo Decision Session.

**Reward amount**  
Số token user nhận lại khi check-in hợp lệ.

**PICK reward**  
Điểm reputation nội bộ user nhận sau check-in. PICK trong MVP này không phải token transferable, mà là điểm reputation lưu trong contract.

**Fund amount**  
Số token admin nạp vào reward pool.

**Initialize**  
Khởi tạo contract. Chỉ gọi một lần sau deploy.

**Fund rewards**  
Nạp token vào reward pool để contract có tiền trả thưởng.

### User

Phần này là app chính cho người dùng: nhập mong muốn, nhận suggestion, chọn địa điểm, rồi tạo Decision Session.

**Mong muốn của bạn**  
Nhu cầu tự nhiên của người dùng, ví dụ “Ăn tối gần đây, dưới 150k/người, không quá ồn, hợp đi nhóm 4 người”.

**Loại địa điểm**  
Loại địa điểm: ăn tối, cà phê, nhà hàng, đi chơi.

**Khu vực**  
Khu vực tìm kiếm.

**Ngân sách / người**  
Ngân sách mỗi người.

**Địa điểm đã chọn**  
Place ID của suggestion đang được chọn. ID này sẽ được ghi vào contract.

**Gợi ý địa điểm**  
Tạo shortlist mẫu gồm 5 địa điểm, chấm điểm theo loại địa điểm, ngân sách và từ khóa trong mong muốn. UI hiển thị lý do suggestion được chọn. Đây là phần off-chain, đúng với PRD: recommendation engine không cần chạy on-chain.

**Suggestion cards**  
Mỗi card là một địa điểm gợi ý. Bấm card để chọn địa điểm cuối cùng.

**Shortlist hash**  
Hash SHA-256 của shortlist. Contract chỉ lưu hash này, không lưu toàn bộ dữ liệu địa điểm.

**Criteria hash**  
Hash SHA-256 của tiêu chí chọn địa điểm.

**Tạo Decision Session**  
Gửi giao dịch on-chain để tạo Decision Session. Freighter sẽ hiện popup để bạn ký.

### Verifier

Phần này mô phỏng xác thực user đã đến địa điểm thật.

**Check-in proof**  
Bằng chứng check-in, ví dụ QR code hoặc chuỗi proof từ merchant. UI hash dữ liệu này trước khi gửi.

**Review**  
Nội dung review. UI hash review trước khi gửi để tránh lưu raw review lên blockchain.

**Hash proof**  
Tạo `checkin_proof_hash` và `review_hash`.

**Confirm check-in**  
Verifier ký giao dịch xác nhận check-in. Sau khi thành công:

- Session chuyển sang `Verified`.
- User nhận reward token nếu reward pool còn đủ.
- User được cộng PICK reputation.
- Review được xem là “Verified Visit”.

### Chain Data

Khung log hiển thị:

- Hash đã tạo.
- Lỗi kết nối ví hoặc RPC.
- Hash giao dịch.
- Kết quả đọc contract.
- Kết quả submit giao dịch.

Nếu nút bấm không có phản hồi, hãy nhìn khung này trước.

## Deploy Contract Lên Testnet

### 1. Tạo admin identity

```bash
stellar keys generate --global fairpick-admin --network testnet --fund
```

Kiểm tra:

```bash
stellar keys list
```

### 2. Build contract

```bash
stellar contract build
```

### 3. Deploy contract

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fairpick.wasm \
  --source fairpick-admin \
  --network testnet
```

CLI sẽ in ra một chuỗi bắt đầu bằng `C...`. Đó là `Contract ID`.

Ví dụ:

```text
CA123...XYZ
```

Dán chuỗi này vào ô `Contract ID` trong UI.

## Lấy Public Key Của Identity

Xem danh sách identity:

```bash
stellar keys list
```

Lấy public key:

```bash
stellar keys address fairpick-admin
```

Bạn có thể tạo verifier:

```bash
stellar keys generate --global fairpick-verifier --network testnet --fund
stellar keys address fairpick-verifier
```

## Payment Token Contract Lấy Ở Đâu?

FairPick cần một token contract để thu session fee và trả reward.

Có 2 cách:

### Cách 1: Dùng SAC của một Stellar asset có sẵn

Nếu bạn có asset dạng `CODE:ISSUER`, deploy SAC:

```bash
stellar contract asset deploy \
  --asset CODE:ISSUER_PUBLIC_KEY \
  --source fairpick-admin \
  --network testnet
```

Kết quả trả về là token contract ID, bắt đầu bằng `C...`. Dán vào `Payment token contract`.

### Cách 2: Chỉ test contract local

Nếu bạn chưa có token testnet, chạy:

```bash
cargo test --locked
```

Unit test tự tạo mock SAC token, mint token, tạo session, xác nhận check-in và kiểm tra reward.

UI on-chain cần token contract thật, vì contract phải gọi `transfer`.

## Flow Sử Dụng Thực Tế Trên UI

### Lần đầu sau khi deploy

1. Mở UI.
2. Dán `Contract ID`.
3. Connect Freighter bằng ví admin.
4. Nhập `Verifier address`.
5. Nhập `Payment token contract`.
6. Bấm `Initialize`.
7. Đảm bảo ví admin có token balance trong payment token.
8. Bấm `Fund rewards`.
9. Bấm `Load config` để kiểm tra.

### User tạo decision

1. Connect Freighter bằng ví user.
2. Nhập nhu cầu, category, budget, area.
3. Nhập `Mong muốn của bạn`.
4. Bấm `Gợi ý địa điểm`.
5. Chọn một suggestion card.
6. Bấm `Tạo Decision Session`.
7. Ký giao dịch trong Freighter.
8. Copy hoặc ghi nhớ Session ID được trả về trong log.

### Verifier xác nhận check-in

1. Connect Freighter bằng ví verifier.
2. Nhập Session ID.
3. Nhập check-in proof.
4. Nhập review.
5. Bấm `Hash proof`.
6. Bấm `Confirm check-in`.
7. Ký giao dịch trong Freighter.
8. Bấm `Load session` để xem trạng thái `Verified`.

## Những Gì Được Lưu On-Chain?

Contract lưu:

- User address.
- Hash của shortlist.
- Hash của criteria.
- ID địa điểm được chọn.
- Hash của check-in proof.
- Hash của review.
- Trạng thái session.
- Reward amount.
- PICK reputation.
- Timestamp tạo và verify.

Contract không lưu:

- GPS raw location.
- Nội dung review đầy đủ.
- Danh sách địa điểm đầy đủ.
- Dữ liệu cá nhân nhạy cảm.

## Lỗi Thường Gặp

### `Failed to find config identity for fairpick-admin`

Bạn chưa tạo identity:

```bash
stellar keys generate --global fairpick-admin --network testnet --fund
```

### `Address already in use`

Port UI đang bị chiếm. Dùng port khác:

```bash
python3 -m http.server 5175 --bind 127.0.0.1 -d ui
```

### Page can't be reached

Kiểm tra server đã chạy chưa:

```bash
curl -I http://127.0.0.1:5174/
```

Chạy lại:

```bash
python3 -m http.server 5174 --bind 127.0.0.1 -d ui
```

Mở đúng URL:

```text
http://127.0.0.1:5174/
```

Không dùng `https`.

### Nút bấm không phản hồi

Hard refresh:

```text
Cmd + Shift + R
```

Sau đó nhìn khung `Chain Data`. Nếu SDK, Freighter hoặc RPC lỗi, app sẽ ghi lỗi ở đó.

### Freighter không hiện popup

Kiểm tra:

- Freighter đã cài chưa.
- Freighter đang ở Testnet chưa.
- Website đang mở bằng `http://127.0.0.1:5174/`.
- Browser đã cho phép Freighter kết nối chưa.

### `Simulation failed`

Thường do:

- Sai Contract ID.
- Contract chưa initialize.
- Sai Payment token contract.
- Account chưa có token balance.
- Reward pool chưa được fund.
- Dùng ví không đúng quyền admin/verifier.

Nếu log có:

```text
Error(Contract, #2)
```

Đó là lỗi `NotInitialized`. Hãy dán đúng `Contract ID`, connect ví admin, nhập `Verifier address` và `Payment token contract`, rồi bấm `Initialize` trước khi user bấm `Tạo Decision Session`.

## Các Lệnh Quan Trọng

```bash
# Test contract
cargo test --locked

# Build contract
stellar contract build

# Chạy UI
python3 -m http.server 5174 --bind 127.0.0.1 -d ui

# Tạo admin testnet
stellar keys generate --global fairpick-admin --network testnet --fund

# Deploy contract
stellar contract deploy \
  --wasm target/wasm32v1-none/release/fairpick.wasm \
  --source fairpick-admin \
  --network testnet

# Xem identities
stellar keys list
```

## Trạng Thái Hiện Tại Của MVP

Hoàn thiện:

- Soroban contract.
- Unit tests.
- WASM build.
- Static web UI.
- Freighter signing flow.
- Hash shortlist/criteria/check-in/review.
- Create session.
- Confirm check-in.
- Read config/session.

Cần chuẩn bị thêm để demo on-chain đầy đủ:

- Deploy contract lên Testnet.
- Có Payment token contract hợp lệ.
- Admin có token balance để fund reward pool.
- User có token balance để trả session fee.
- Verifier dùng đúng ví đã cấu hình.
# FairPick
