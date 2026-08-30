<div align="center">

<img src="../../icons/icon128.png" width="88" alt="Stash">

# Stash

**Lưu một khung hình, một đoạn clip hoặc âm thanh của nó từ Instagram và TikTok chỉ bằng một cú nhấp. Một tiện ích trình duyệt nhỏ để gom tư liệu tham khảo.**

[![Bản mới nhất](https://img.shields.io/github/v/release/antonyshakirov/stash)](https://github.com/antonyshakirov/stash/releases/latest)
[![Giấy phép](https://img.shields.io/badge/license-MIT-blue)](../../LICENSE)
![Trình duyệt](https://img.shields.io/badge/browsers-Chrome%20%C2%B7%20Firefox-555)

[Bahasa Indonesia](README.id.md) · [Deutsch](README.de.md) · [English](../../README.md) · [Español](README.es.md) · [Français](README.fr.md) · [Italiano](README.it.md) · [Nederlands](README.nl.md) · [Polski](README.pl.md) · [Português](README.pt.md) · **Tiếng Việt** · [Türkçe](README.tr.md) · [Русский](README.ru.md) · [Українська](README.uk.md) · [עברית](README.he.md) · [اردو](README.ur.md) · [العربية](README.ar.md) · [فارسی](README.fa.md) · [हिन्दी](README.hi.md) · [ไทย](README.th.md) · [中文](README.zh.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

</div>

Mở một bài đăng và một nút tròn hiện ra ở góc. Nhấn vào đó, thứ đang trên màn hình sẽ nằm trong thư mục tải xuống của bạn. Công cụ chỉ có vậy.

## Cài đặt

### Chrome

Chrome không cho phép cài tiện ích từ ngoài cửa hàng của chính nó, còn cửa hàng ấy không đăng loại tiện ích này. Vì vậy phải cài thủ công:

1. Tải `stash-chrome-x.y.z.zip` từ [bản phát hành mới nhất](https://github.com/antonyshakirov/stash/releases/latest) rồi giải nén.
2. Mở `chrome://extensions` và bật chế độ dành cho nhà phát triển.
3. Nhấn «Tải tiện ích đã giải nén» và chọn thư mục vừa giải nén.

Việc cập nhật cũng thủ công. Tiện ích đã giải nén không bao giờ tự cập nhật — Chrome không có cơ chế nào cho việc đó. Hãy tải bản mới và nhấn «Tải lại» ngay trên trang ấy.

### Firefox

[Cài Stash](https://antonshakirov.com/stash/stash-latest.xpi) chỉ bằng một cú nhấp. Gói đã được Mozilla ký, nên không cần cửa hàng lẫn chế độ nhà phát triển, và nó tự cập nhật. Cần Firefox 140 trở lên.

Hãy tải lại các thẻ đang mở sau khi cài: tiện ích không với tới chúng.

## Cách hoạt động

Mở trọn bài đăng hoặc đoạn clip. Trên Instagram đó là địa chỉ dạng `/p/…` hoặc `/reel/…`, trên TikTok là `/@tác-giả/video/…` hoặc `/@tác-giả/photo/…`. Một nút tròn hiện ở góc dưới bên phải, và bên cạnh là nút hình nốt nhạc khi có âm thanh để lấy.

Khung hình được lưu từng cái một. Trong một băng chuyền ảnh, hãy lướt tới trang bạn muốn rồi nhấn: đúng trang đó sẽ được lưu. Ba trang trong bảy nghĩa là nhấn ba lần.

Ở bảng tin và lưới hồ sơ cố ý không có nút. Thứ nằm dưới con trỏ ở đó là ảnh thu nhỏ, và tệp sẽ tệ hơn bản gốc.

Âm thanh được rút ra từ chính đoạn clip và dài đúng bằng nó. Mười giây của một bài hát trong clip là mười giây trong tệp.

Lưu cùng một khung hình hai lần không tạo bản trùng: tiện ích nhớ những gì đã có và nói ra. Nếu vẫn muốn bản sao, hãy nhấn lần thứ hai liên tiếp.

## Tệp được lưu ở đâu

| Cái gì | Ở đâu | Ví dụ tên |
|---|---|---|
| Clip | `Downloads/Saved Reels` | `nike — 2026-08-01 — DKx9dQ2.mp4` |
| Ảnh | `Downloads/Saved Photos` | `nike — 2026-08-01 — DKx9dQ2 — 3.jpg` |
| Âm thanh | `Downloads/Saved Audio` | `nike — 2026-08-01 — DKx9dQ2.m4a` |

Con số ở cuối là số thứ tự trang trong băng chuyền ảnh. Bài đăng thường không có.

Tên thư mục có thể đổi: nhấp chuột phải vào biểu tượng Stash trên thanh công cụ rồi chọn «Tùy chọn». Ô để trống sẽ khôi phục tên mặc định. Dấu gạch chéo nghĩa là lồng nhau: `Refs/Saved Reels` đặt một thư mục bên trong thư mục khác.

## Những gì Stash không làm

Stash không tự mình gửi một yêu cầu nào tới Instagram hay TikTok. Tiện ích đọc dữ liệu mà trang vốn đã nhận để hiển thị bài đăng cho bạn, và khi không có dữ liệu ấy thì nó nói ra thay vì đi lấy. Không có gì được gửi đi đâu cả: tệp đi từ CDN của nền tảng tới ổ đĩa của chính người đang xem bài đăng.

Không chữ ký hay lớp bảo vệ nào bị vượt qua, không đăng nhập nào được tự động hóa, không tài khoản của ai bị đụng tới, và không thống kê nào được thu thập.

Không có tải hàng loạt băng chuyền ảnh, hồ sơ hay bộ sưu tập, không có hàng đợi tải, không có chọn chất lượng bằng tay. Âm thanh được sao chép nguyên trạng.

YouTube không được hỗ trợ.

## Quyền và trách nhiệm

Stash không liên kết với Instagram, TikTok hay Meta và không được họ chấp thuận. Tên của họ xuất hiện ở đây chỉ để nói tiện ích hoạt động ở đâu.

Quyền đối với những gì bạn lưu thuộc về người đã đăng chúng. Tiện ích này không trao bất kỳ quyền nào đối với tư liệu của người khác. Lưu tác phẩm của ai đó để xem và gom tư liệu tham khảo là một chuyện; đăng lại hay dùng vào mục đích thương mại là chuyện khác, và người đã lưu phải chịu trách nhiệm.

## Thêm nữa

Việc dựng bản, kiến trúc mã nguồn và xử lý sự cố nằm trong [README tiếng Anh](../../README.md).

## Giấy phép

[MIT](../../LICENSE).
