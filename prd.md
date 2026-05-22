# TÊN DỰ ÁN: FairPick

## VẤN ĐỀ (1 câu):
Người trẻ, sinh viên và nhóm bạn thường mất nhiều thời gian khi đi chơi vì khó chọn món ăn, quán cà phê, nhà hàng hoặc địa điểm vui chơi gần mình, đồng thời không biết recommendation có bị quảng cáo/thao túng hay không.

## GIẢI PHÁP (1 câu):
FairPick là một dApp giúp người dùng nhận shortlist địa điểm gần vị trí hiện tại, sau đó dùng Stellar Soroban contract để ghi nhận quyết định minh bạch, xác thực check-in/review và thưởng USDC hoặc token uy tín cho người dùng đóng góp dữ liệu thật.

## TÍNH NĂNG STELLAR SỬ DỤNG:
[x] Chuyển XLM/USDC    [x] Token tùy chỉnh    [x] Soroban contract
[ ] DEX tích hợp        [x] Trustline          [ ] Clawback/Tuân thủ

## NGƯỜI DÙNG MỤC TIÊU:
Sinh viên, người trẻ, nhóm bạn, cặp đôi hoặc dân văn phòng ở thành phố lớn thường xuyên gặp khó khăn khi phải chọn địa điểm ăn uống/đi chơi gần mình.

## TÍNH NĂNG CỐT LÕI (MVP):
Giao dịch DUY NHẤT chứng minh MVP hoạt động:

Người dùng tạo một “Decision Session” bằng cách gửi một khoản nhỏ USDC vào Soroban contract. Contract ghi lại hash của shortlist địa điểm, tiêu chí chọn địa điểm, địa điểm được chọn cuối cùng và phát reward/badge cho người dùng sau khi check-in hợp lệ.

Ví dụ flow MVP:

1. User chọn nhu cầu: “Ăn tối gần đây, dưới 150k/người”.
2. Backend tạo shortlist 5 địa điểm gần user.
3. Backend gửi `shortlistHash`, `criteriaHash`, `selectedPlaceId` vào Soroban contract.
4. User ký một giao dịch trên Stellar.
5. Contract ghi nhận kết quả chọn địa điểm và chuyển một phần nhỏ USDC/reward token cho user sau khi check-in.
6. Review của user được gắn nhãn “Verified Visit”.

## TẠI SAO STELLAR:
Nếu làm bằng tài chính truyền thống, việc thưởng người dùng bằng tiền thật cho mỗi check-in/review sẽ cần tài khoản ngân hàng, ví điện tử, đối soát, phí giao dịch cao và thời gian xử lý lâu. Với Stellar, app có thể gửi reward nhỏ bằng USDC/XLM với chi phí thấp và settlement nhanh hơn nhiều so với hệ thống thanh toán truyền thống.

So với nhiều chain khác, Stellar phù hợp hơn cho use case này vì:
- Có USDC dùng được cho payment/reward trong app.
- Phí giao dịch thấp, phù hợp với micro-reward cho check-in/review.
- Soroban contract cho phép ghi nhận logic minh bạch như Decision Session, proof-of-check-in và reward.
- Trustline giúp người dùng chủ động nhận asset như USDC hoặc token reputation.
- Stellar được thiết kế mạnh cho thanh toán, nên hợp với app có incentive/reward thực tế hơn là chỉ lưu dữ liệu on-chain.

## ĐIỂM KHÁC BIỆT SO VỚI WEB APP THÔNG THƯỜNG:
Web app thông thường có thể tự ý thay đổi thuật toán, ưu tiên quán trả tiền quảng cáo hoặc chỉnh sửa review trong database mà người dùng khó kiểm chứng.

FairPick khác biệt ở chỗ:
- Mỗi lần chọn địa điểm quan trọng có thể được ghi nhận bằng Soroban contract.
- Review có thể gắn với proof-of-visit thay vì chỉ là review ẩn danh.
- Người dùng nhận USDC/token reward khi đóng góp dữ liệu thật.
- Reputation của reviewer có thể trở thành token/badge, giúp recommendation đáng tin hơn.
- Merchant không thể chỉ trả tiền để thao túng toàn bộ kết quả mà không để lại dấu vết.

## PHẠM VI MVP:
MVP không cần xây toàn bộ AI recommendation phức tạp ngay từ đầu. Chỉ cần:

- Lấy vị trí người dùng.
- Lọc địa điểm gần đó theo category, budget, rating.
- Tạo shortlist 3–5 địa điểm.
- Cho user bấm “Pick for me”.
- Ghi kết quả vào Soroban contract.
- Sau khi user check-in bằng QR tại địa điểm, phát reward nhỏ bằng USDC hoặc token reputation.

## STELLAR ASSET / TOKEN ĐỀ XUẤT:
Tên token tùy chỉnh: PICK

Mục đích:
- Không dùng để đầu cơ.
- Dùng làm reputation point.
- User nhận PICK khi check-in thật, review hữu ích hoặc tham gia vote địa điểm.
- Review từ user có nhiều PICK/reputation sẽ có weight cao hơn trong hệ thống recommendation.

## RỦI RO / LƯU Ý:
- Không nên lưu GPS raw location trực tiếp lên blockchain vì ảnh hưởng quyền riêng tư.
- Chỉ nên lưu hash/proof của decision, check-in hoặc review.
- Recommendation engine vẫn nên chạy off-chain để nhanh, rẻ và dễ tối ưu.
- Blockchain chỉ nên dùng cho phần cần minh bạch: payment, reward, verified visit, reputation và decision proof.