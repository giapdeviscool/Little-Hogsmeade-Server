# Tài liệu Phân Quyền Các Module (Roles & Permissions)

Tài liệu này mô tả chi tiết quyền truy cập (Role-based Authorization) đối với từng module (file route) trong hệ thống Little Hogsmeade Server.

Cơ chế phân quyền được áp dụng bằng Middleware `verifyRole` dựa trên 5 loại Role chính:
- `owner`: Chủ doanh nghiệp (Toàn quyền)
- `chain admin`: Quản lý chuỗi (Toàn quyền)
- `manager`: Quản lý chi nhánh
- `cashier`: Thu ngân
- `staff`: Nhân viên phục vụ

---

## 1. Module Bán hàng & Thu ngân (POS)
*Nhóm đối tượng được truy cập: `['owner', 'chain admin', 'manager', 'cashier']`*

Các API thuộc nhóm này tập trung vào khâu lên đơn, thanh toán, in bill.
- `order.routes.js`: Quản lý giỏ hàng, đặt món.
- `invoice.routes.js`: Quản lý hóa đơn, thanh toán.
- `payment.routes.js`: Giao dịch thanh toán.
- `cashier-shift.routes.js`: Quản lý ca thu ngân (Mở/Đóng ca).

---

## 2. Module Vận hành & Phục vụ (Operation)
*Nhóm đối tượng được truy cập: `['owner', 'chain admin', 'manager', 'cashier', 'staff']`*

Các API thuộc nhóm này hỗ trợ các thao tác trực tiếp với khách hàng tại bàn và khách hàng giao đi.
- `table.routes.js`: Quản lý trạng thái sơ đồ bàn.
- `reservation.routes.js`: Quản lý danh sách đặt bàn.
- `customer.routes.js`: Tra cứu thông tin khách hàng (CRM).
- `delivery.routes.js`: Theo dõi các đơn đặt giao hàng đi xa.

---

## 3. Module Quản trị Nội bộ (Internal Management)
*Nhóm đối tượng được truy cập: `['owner', 'chain admin', 'manager']`*

Các API cấu hình, quản trị vận hành bên trong chi nhánh. Nhân viên (staff, cashier) không được phép truy cập.

**3.1. Quản lý Nhân sự & Lương:**
- `employee.routes.js`: Hồ sơ nhân sự, cấp Role.
- `shift.routes.js`: Định nghĩa khung giờ làm việc.
- `roster.routes.js`: Lên lịch làm việc.
- `attendance.routes.js`: Chấm công.
- `payroll.routes.js`: Quản lý bảng lương.

**3.2. Quản lý Sản phẩm (Menu & Công thức):**
- `category.routes.js`: Nhóm món ăn.
- `menu-item.routes.js`: Danh sách món.
- `branch-menu.routes.js`: Món ăn tại từng chi nhánh.
- `topping-group.routes.js`: Nhóm topping.
- `recipe.routes.js`: Công thức / Định lượng.

**3.3. Quản lý Kho bãi:**
- `ingredient.routes.js`: Nguyên vật liệu.
- `preparation.routes.js`: Bán thành phẩm (chế biến sẵn).
- `stock-conversion.routes.js`: Quy đổi đơn vị kho.

**3.4. Quản lý Khuyến mãi & Tích điểm:**
- `loyalty.routes.js`: Cấu hình tích điểm hạng thẻ.
- `promotion.routes.js`: Tạo voucher, combo khuyến mãi.

**3.5. Module CMS (Nội dung Landing Page):**
- `page.routes.js`: Nội dung tĩnh (Giới thiệu...).
- `banner.routes.js`: Banner quảng cáo.
- `post.routes.js`: Bài viết, tin tức ẩm thực.
- `event.routes.js`: Sự kiện tại quán.
- `upload.routes.js`: Tải lên hình ảnh.

---

## 4. Module Quản trị Chuỗi (Chain Admin)
*Nhóm đối tượng được truy cập: `['owner', 'chain admin']`*

Các API chỉ dành cho cấp độ Chủ thương hiệu hoặc Ban giám đốc.
- `chain.routes.js`: Cấu hình toàn hệ thống chuỗi.
- `branch.routes.js`: Thêm, sửa, xóa các chi nhánh Bistro.
- `admin.routes.js`: Xem báo cáo, thống kê tập trung của toàn chuỗi.

---

*(Tài liệu này được tự động tạo dựa trên cấu hình Routes cập nhật mới nhất của hệ thống).*
