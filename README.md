# Little Hogsmeade Server

Express JSON API dùng Prisma với MongoDB cho hệ thống Little Hogsmeade.

Luồng xử lý API:

```txt
route -> controller -> service -> repository -> prisma -> MongoDB
```

## Yêu Cầu

- Node.js
- npm
- Docker Desktop

## Cấu Hình Môi Trường

Tạo file `.env` từ file mẫu:

```bash
cp .env.example .env
```

Cấu hình mặc định cho database local:

```env
DATABASE_URL="mongodb://localhost:27029/little_hogsmeade?replicaSet=rs0&directConnection=true"
PORT=3000
NODE_ENV=development
JWT_SECRET="change-me-in-local-dev"
```

## MongoDB Bằng Docker

Chạy MongoDB:

```bash
docker compose -f docker-compose.local.yml up -d
```

Khởi tạo replica set cho MongoDB local sau lần chạy đầu tiên:

```bash
docker exec little-hogsmeade-mongo mongosh --quiet --eval 'try { rs.status() } catch (error) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] }) }'
```

Kiểm tra container:

```bash
docker compose -f docker-compose.local.yml ps
```

Xem log MongoDB:

```bash
docker compose -f docker-compose.local.yml logs -f wdp-db
```

Dừng MongoDB:

```bash
docker compose -f docker-compose.local.yml down
```

Dừng MongoDB và xóa luôn dữ liệu local:

```bash
docker compose -f docker-compose.local.yml down -v
```

Chỉ dùng `down -v` khi muốn xóa dữ liệu dev local.

## Cài Đặt

```bash
npm install
```

## Prisma

Generate Prisma Client:

```bash
npm run prisma:generate
```

Đẩy schema Prisma lên MongoDB:

```bash
npm run prisma:push
```

Mở Prisma Studio:

```bash
npm run prisma:studio
```

Validate schema:

```bash
npx prisma validate
```

Vì project dùng MongoDB, dùng `prisma db push`. Không dùng `prisma migrate dev`.

## Chạy Server

Chạy dev:

```bash
npm run dev
```

Chạy bằng node:

```bash
npm start
```

Base URL:

```txt
http://localhost:3000
```

API base URL:

```txt
http://localhost:3000/api/v1
```

## Workflow Dev

Setup lần đầu:

```bash
npm install
cp .env.example .env
docker compose -f docker-compose.local.yml up -d
docker exec little-hogsmeade-mongo mongosh --quiet --eval 'try { rs.status() } catch (error) { rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "localhost:27017" }] }) }'
npm run prisma:generate
npm run prisma:push
npm run dev
```

Chạy hằng ngày:

```bash
docker compose -f docker-compose.local.yml up -d
npm run dev
```

Sau khi sửa `prisma/schema.prisma`, chạy:

```bash
npm run prisma:generate
npm run prisma:push
```

Nếu thêm model mới trong `prisma/schema.prisma`, thêm model đó vào:

```txt
src/config/resources.js
```

File này quyết định resource nào được tự động mount route CRUD dưới `/api/v1`.

## Cấu Trúc Thư Mục

```txt
prisma/
  schema.prisma
src/
  config/
    env.js
    resources.js
  controllers/
    auth.controller.js
    resource.controller.js
    user.controller.js
  lib/
    prisma.js
  middlewares/
  repositories/
    resource.repository.js
    user.repository.js
  routes/
    auth.routes.js
    index.js
    resource.routes.js
    user.routes.js
  services/
    auth.service.js
    resource.service.js
    user.service.js
  utils/
  validators/
routes/
public/
```

## Thiết Kế API

Project hiện có 2 kiểu API:

- `/api/v1/auth`: register/login chung cho `customers` và `employees`.
- `/api/v1/users`: module riêng, có controller/service/repository/validator riêng.
- Các bảng từ thiết kế DB Excel: dùng generic CRUD chung qua `resource.*`.

Các file generic CRUD:

```txt
src/config/resources.js
src/routes/resource.routes.js
src/controllers/resource.controller.js
src/services/resource.service.js
src/repositories/resource.repository.js
```

## Endpoint Chính

Root:

```txt
GET /
```

Danh sách resource đang được mount:

```txt
GET /api/v1/resources
```

Auth:

```txt
POST /api/v1/auth/register
POST /api/v1/auth/login
```

Users:

```txt
GET    /api/v1/users
GET    /api/v1/users/:id
POST   /api/v1/users
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id
```

Generic CRUD cho các bảng:

```txt
GET    /api/v1/:resource
GET    /api/v1/:resource/:id
POST   /api/v1/:resource
PATCH  /api/v1/:resource/:id
DELETE /api/v1/:resource/:id
```

Query params cho API list:

```txt
limit  số record muốn lấy, tối đa 100
skip   số record muốn bỏ qua
```

Ví dụ:

```bash
curl "http://localhost:3000/api/v1/menu-items?limit=20&skip=0"
```

## Danh Sách Resource

Có thể dùng URL dạng gạch ngang hoặc alias đúng tên bảng gốc trong Excel.

```txt
branches                    /api/v1/branches
branch_configs              /api/v1/branch-configs              hoặc /api/v1/branch_configs
roles                       /api/v1/roles
employees                   /api/v1/employees
shifts                      /api/v1/shifts
timesheets                  /api/v1/timesheets
categories                  /api/v1/categories
menu_items                  /api/v1/menu-items                  hoặc /api/v1/menu_items
menu_item_variants          /api/v1/menu-item-variants          hoặc /api/v1/menu_item_variants
topping_groups              /api/v1/topping-groups              hoặc /api/v1/topping_groups
toppings                    /api/v1/toppings
menu_item_topping_groups    /api/v1/menu-item-topping-groups    hoặc /api/v1/menu_item_topping_groups
ingredients                 /api/v1/ingredients
recipes                     /api/v1/recipes
areas                       /api/v1/areas
tables                      /api/v1/tables
customers                   /api/v1/customers
membership_tiers            /api/v1/membership-tiers            hoặc /api/v1/membership_tiers
customer_memberships        /api/v1/customer-memberships        hoặc /api/v1/customer_memberships
loyalty_configs             /api/v1/loyalty-configs             hoặc /api/v1/loyalty_configs
point_transactions          /api/v1/point-transactions          hoặc /api/v1/point_transactions
orders                      /api/v1/orders
order_items                 /api/v1/order-items                 hoặc /api/v1/order_items
order_item_toppings         /api/v1/order-item-toppings         hoặc /api/v1/order_item_toppings
invoices                    /api/v1/invoices
payments                    /api/v1/payments
delivery_orders             /api/v1/delivery-orders             hoặc /api/v1/delivery_orders
stock_transactions          /api/v1/stock-transactions          hoặc /api/v1/stock_transactions
purchase_orders             /api/v1/purchase-orders             hoặc /api/v1/purchase_orders
purchase_order_items        /api/v1/purchase-order-items        hoặc /api/v1/purchase_order_items
expense_categories          /api/v1/expense-categories          hoặc /api/v1/expense_categories
expenses                    /api/v1/expenses
campaigns                   /api/v1/campaigns
vouchers                    /api/v1/vouchers
voucher_usages              /api/v1/voucher-usages              hoặc /api/v1/voucher_usages
pages                       /api/v1/pages
banners                     /api/v1/banners
posts                       /api/v1/posts
events                      /api/v1/events
reservations                /api/v1/reservations
```

## Ví Dụ Request

Đăng ký:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "accountType": "customer",
    "fullName": "Nguyen Van A",
    "phone": "0900000000",
    "email": "customer@example.com",
    "password": "123456",
    "birthday": "2000-01-01T00:00:00.000Z"
  }'
```

Đăng ký nhân viên:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "accountType": "employee",
    "fullName": "Nguyen Van B",
    "phone": "0911111111",
    "email": "staff@example.com",
    "password": "123456",
    "branchId": "66504a1f3b8f8c5e8f4a1111",
    "roleId": "66504a1f3b8f8c5e8f4a2222",
    "pinCode": "123456"
  }'
```

Đăng nhập:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "0900000000",
    "password": "123456"
  }'
```

Tạo user:

```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","name":"Demo User"}'
```

Tạo chi nhánh:

```bash
curl -X POST http://localhost:3000/api/v1/branches \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Little Hogsmeade - Ho Tay",
    "address": "Ha Noi",
    "phone": "0900000000",
    "email": "hotay@example.com",
    "lat": 21.058,
    "lng": 105.81,
    "openTime": "2026-01-01T07:00:00.000Z",
    "closeTime": "2026-01-01T23:00:00.000Z"
  }'
```

Tạo role:

```bash
curl -X POST http://localhost:3000/api/v1/roles \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manager",
    "permissions": ["orders.read", "orders.write", "menu.write"]
  }'
```

Lấy một record:

```bash
curl http://localhost:3000/api/v1/branches/66504a1f3b8f8c5e8f4a1111
```

Cập nhật một record:

```bash
curl -X PATCH http://localhost:3000/api/v1/branches/66504a1f3b8f8c5e8f4a1111 \
  -H "Content-Type: application/json" \
  -d '{"status":"maintenance"}'
```

Xóa một record:

```bash
curl -X DELETE http://localhost:3000/api/v1/branches/66504a1f3b8f8c5e8f4a1111
```

## Quy Ước Body

Body JSON dùng tên field theo Prisma, không dùng tên cột database.

```txt
branch_id     -> branchId
created_at    -> createdAt
menu_item_id  -> menuItemId
base_price    -> basePrice
```

Date/time gửi bằng ISO string:

```json
{
  "orderedAt": "2026-05-22T10:30:00.000Z",
  "reservedDate": "2026-05-22T00:00:00.000Z",
  "reservedTime": "2026-05-22T19:00:00.000Z"
}
```

Foreign key dùng MongoDB ObjectId string:

```json
{
  "branchId": "66504a1f3b8f8c5e8f4a1111"
}
```

Generic CRUD hiện chỉ validate cơ bản `id` và body object. Khi module nào cần validate nghiệp vụ chặt hơn, tạo validator/service riêng giống module `users`.

## Response Format

Thành công:

```json
{
  "data": {}
}
```

Lỗi:

```json
{
  "message": "Error message"
}
```

## npm Scripts

```txt
npm run dev              chạy server với nodemon
npm start                chạy server bằng node
npm run prisma:generate  generate Prisma Client
npm run prisma:push      sync schema lên MongoDB
npm run prisma:studio    mở Prisma Studio
```
