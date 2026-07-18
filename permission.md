# Kế Hoạch Phân Quyền Kiến Trúc Hệ Thống (RBAC Matrix Authorization)
## Dự án: Hệ thống Quản lý Chuỗi Bistro Cafe (Little Hogsmeade - BCMS)

Tài liệu này mô tả chi tiết quyền truy cập (Role-based Authorization) đối với từng phân hệ (module) trong hệ thống Little Hogsmeade Server dựa trên mô hình Role-Based Access Control (RBAC).

Hệ thống có 5 vai trò (Roles) chính:
- **`owner` / `chain admin`**: Chủ chuỗi nhà hàng (Chain Owner / Super Admin), giữ quyền hạn tối cao toàn hệ thống.
- **`manager`**: Quản lý chi nhánh (Branch Manager), quản trị nhân sự, điều phối kho hàng tại chi nhánh.
- **`cashier`**: Thu ngân kiêm nhân viên phục vụ, thực hiện nghiệp vụ bán hàng tại quầy.
- **`kitchen`**: Nhân viên bếp/pha chế (Kitchen / Bar Staff), quản lý công thức, tồn kho khu vực pha chế.
- **`staff`**: Nhân viên phục vụ bàn.
*(Khách hàng - Customer: Không yêu cầu verifyRole nội bộ mà dùng xác thực thông thường)*

---

### 1. Phân hệ 1: Quản trị Hệ thống & Chuỗi (Global Settings)
*Quyền truy cập: `['owner', 'chain admin']`*

Các API cấu hình chung cho toàn bộ chuỗi:
- `chain.routes.js`: Cấu hình toàn hệ thống chuỗi.
- `branch.routes.js`: Quản lý danh mục Chi nhánh.
- `admin.routes.js`: Xem Dashboard & Lọc báo cáo tổng hợp (Manager có thể xem báo cáo riêng nhưng thuộc module khác).
- `loyalty.routes.js`: Cấu hình quy tắc tích điểm & đổi thưởng CRM.

---

### 2. Phân hệ 2: Quản lý Nội dung CMS (Landing Page Content)
*Quyền truy cập: `['owner', 'chain admin']` (Chỉ Manager được truy cập một phần như Event, Promotion)*

Quản lý nội dung cho ứng dụng của Khách hàng:
- `page.routes.js`: Nội dung tĩnh (Giới thiệu...).
- `banner.routes.js`: Banner quảng cáo.
- `post.routes.js`: Bài viết, tin tức ẩm thực.
- `upload.routes.js`: Tải lên hình ảnh.
- `event.routes.js`: Sự kiện tại quán (Có thêm `manager`).
- `promotion.routes.js`: Tạo voucher, combo khuyến mãi (Có thêm `manager`).

---

### 3. Phân hệ 3: Nhân sự & Vận hành Chi nhánh (HR & Local Operations)
*Quyền truy cập: `['owner', 'chain admin', 'manager']`*

Quản lý thông tin nhân sự làm việc tại chi nhánh:
- `employee.routes.js`: Hồ sơ nhân sự, cấp Role.
- `shift.routes.js`: Định nghĩa khung giờ làm việc.
- `roster.routes.js`: Lên lịch làm việc.
- `payroll.routes.js`: Quản lý bảng lương.
- `attendance.routes.js`: Chấm công (Thêm cả `cashier`, `kitchen`, `staff`).

---

### 4. Phân hệ 4: Thực đơn, Công thức & Kho hàng (Menu & Inventory)
*Quyền truy cập: Chủ yếu là `['owner', 'chain admin', 'manager']`, một phần bếp `kitchen`*

Quản lý hàng hóa, công thức, tồn kho:
- `category.routes.js`, `menu-item.routes.js`, `topping-group.routes.js`, `branch-menu.routes.js`: Quản lý danh mục món ăn (Chỉ CO, BM).
- `recipe.routes.js`: Công thức / Định lượng (Có thêm `kitchen`).
- `ingredient.routes.js`, `preparation.routes.js`, `stock-conversion.routes.js`: Quản lý kho, xuất nhập tồn, bán thành phẩm (Có thêm `kitchen`).

---

### 5. Phân hệ 5: Nghiệp vụ Quầy POS & Đơn hàng (POS & Order Desk)
*Quyền truy cập: Thu ngân (`cashier`), Quản lý (`chain admin`), Bếp (`kitchen`)*

- `order.routes.js`: Tạo, sửa, cập nhật trạng thái đơn (`owner`, `chain admin`, `manager`, `cashier`, `kitchen`).
- `invoice.routes.js`, `payment.routes.js`: Thanh toán hóa đơn, hoàn tiền (`owner`, `chain admin`, `manager`, `cashier`).
- `cashier-shift.routes.js`: Quản lý ca thu ngân (`owner`, `chain admin`, `manager`, `cashier`).
- `table.routes.js`: Quản lý trạng thái sơ đồ bàn (`owner`, `chain admin`, `manager`, `cashier`, `kitchen`).
- `delivery.routes.js`: Quản lý đơn giao hàng (`owner`, `chain admin`, `manager`, `cashier`).

---

### 6. Phân hệ 6: Luồng Khách hàng Thân thiết (Landing Page & CRM)
*Quyền truy cập nội bộ xem KH: `['owner', 'chain admin', 'manager', 'cashier']`*

- `customer.routes.js`: Tra cứu hạng thành viên, lịch sử đổi điểm.
- `reservation.routes.js`: Tiếp nhận yêu cầu đặt bàn.

*(Các route của Khách hàng tự gọi API thông qua xác thực jwt token bình thường mà không cần check Role).*
