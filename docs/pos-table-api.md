# POS Table API

Tài liệu này dành cho frontend POS tích hợp sơ đồ bàn và modal hóa đơn.

## Base URL

```text
http://localhost:3000/api/v1
```

Các endpoint nghiệp vụ của bàn yêu cầu access token:

```http
Authorization: Bearer <access_token>
```

`tableId` và `branchId` là MongoDB ObjectId gồm 24 ký tự hex.

## 1. Lấy sơ đồ bàn theo chi nhánh

```http
GET /branches/:branchId/tables
```

Query tùy chọn:

| Query | Giá trị | Mô tả |
| --- | --- | --- |
| `area` | string | Chỉ lấy một khu vực theo tên. |
| `status` | `available`, `occupied`, `reserved` | Lọc bàn theo trạng thái. |

Ví dụ Axios:

```js
const response = await api.get(`/branches/${branchId}/tables`, {
  params: { status: 'available' }
});

const layout = response.data.data;
```

Response mẫu:

```json
{
  "status": "success",
  "data": {
    "branch_id": "6a30ee84f738f50016f8c737",
    "branch_name": "Little Hogsmeade Flagship",
    "total_tables": 15,
    "areas": [
      {
        "area_name": "Trong nhà",
        "tables": [
          {
            "id": "6a395e15b96c0001760e110f",
            "name": "Bàn T1-01",
            "capacity": 4,
            "status": "occupied",
            "current_order_id": "6a...",
            "updated_at": "2026-06-23T02:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

`current_order_id` chỉ có khi bàn `occupied`; `reservation_id` chỉ có khi bàn `reserved`.

## 2. Lấy hóa đơn hiện tại của bàn đang phục vụ

```http
GET /tables/:tableId/current-order
```

Endpoint tìm đơn có trạng thái `PENDING` hoặc `pending` gắn với bàn, đồng thời kiểm tra nhân viên có quyền ở chi nhánh của bàn.

Ví dụ Axios:

```js
const response = await api.get(`/tables/${tableId}/current-order`);
const order = response.data.data;
```

Response mẫu:

```json
{
  "status": "success",
  "data": {
    "table_id": "6a395e15b96c0001760e110f",
    "table_name": "Bàn T1-01",
    "order_id": "6a3f1e15b96c0001760e1200",
    "order_code": "ORD-1200",
    "guest_count": 2,
    "created_at": "2026-06-22T19:00:00.000Z",
    "total_amount": 350000,
    "items": [
      {
        "name": "Cà phê sữa đá",
        "quantity": 1,
        "price": 45000
      },
      {
        "name": "Bò bít tết - Size lớn",
        "quantity": 1,
        "price": 305000
      }
    ]
  }
}
```

`total_amount` là tổng `subtotal` của các dòng món. `price` là đơn giá của một món; frontend hiển thị thành tiền bằng `quantity * price`.

## 3. Lấy thông tin đặt bàn hiện tại

```http
GET /tables/:tableId/reservation
```

Endpoint trả về reservation có trạng thái `pending`, `confirmed` hoặc `reserved` đang gắn với bàn. Endpoint yêu cầu Bearer token và kiểm tra quyền chi nhánh.

Ví dụ Axios:

```js
const response = await api.get(`/tables/${tableId}/reservation`);
const reservation = response.data.data;
```

Response mẫu:

```json
{
  "status": "success",
  "data": {
    "table_id": "6a39f0729db1e903d4054ad1",
    "table_name": "Bàn N-01",
    "reservation_id": "6a39f5459d76506f2b76d4df",
    "guest_name": "Nguyen Van A",
    "guest_phone": "0900000091",
    "guest_count": 6,
    "reserved_date": "2026-06-23T12:30:00.000Z",
    "reserved_time": "2026-06-23T12:30:00.000Z",
    "note": "Khach VIP, chuan bi ghe tre em",
    "status": "reserved"
  }
}
```

Nếu bàn không có reservation còn hiệu lực, API trả `404` với `message: "No active reservation found for this table"`.

## 4. Đặt bàn (luồng API hiện có)

Hiện backend chưa có endpoint nghiệp vụ gộp để tạo reservation và reserve bàn trong một transaction. Frontend phải gọi **hai request theo thứ tự** dưới đây. Chỉ gọi request thứ hai khi request tạo reservation thành công.

### Bước 1: Tạo reservation

```http
POST /reservations
Content-Type: application/json
```

Payload dùng **camelCase**:

```json
{
  "branchId": "6a30ee84f738f50016f8c737",
  "tableId": "6a39f0739db1e903d4054ad3",
  "guestName": "Nguyen Van A",
  "guestPhone": "0901112233",
  "guestCount": 4,
  "reservedDate": "2026-06-23T00:00:00.000Z",
  "reservedTime": "2026-06-23T12:30:00.000Z",
  "note": "Can ghe tre em",
  "status": "reserved"
}
```

Các field bắt buộc theo schema là `branchId`, `guestName`, `guestPhone`, `guestCount`, `reservedDate`, `reservedTime`. Khi đặt vào một bàn cụ thể, frontend phải gửi thêm `tableId`.

### Bước 2: Liên kết và đổi trạng thái bàn

```http
PATCH /tables/:tableId/status
Content-Type: application/json
Authorization: Bearer <access_token>
```

```json
{
  "status": "reserved",
  "reservation_id": "<id trả về từ bước 1>",
  "guest_count": 4,
  "note": "Can ghe tre em"
}
```

Ví dụ Axios:

```js
const reservationResponse = await api.post('/reservations', {
  branchId,
  tableId,
  guestName: values.guestName,
  guestPhone: values.guestPhone,
  guestCount: Number(values.guestCount),
  reservedDate: values.reservedDate,
  reservedTime: values.reservedTime,
  note: values.note || null,
  status: 'reserved'
});

const reservationId = reservationResponse.data.data.id;

await api.patch(`/tables/${tableId}/status`, {
  status: 'reserved',
  reservation_id: reservationId,
  guest_count: Number(values.guestCount),
  note: values.note || ''
});
```

> Lưu ý: hai request này chưa atomic. Nếu bước 2 thất bại, frontend cần báo lỗi và có thể xóa reservation vừa tạo. Nên bổ sung một endpoint nghiệp vụ transaction trong backend trước khi dùng cho production.

## 5. Cập nhật trạng thái bàn

```http
PATCH /tables/:tableId/status
Content-Type: application/json
```

Payload:

```json
{
  "status": "reserved",
  "reservation_id": "6a3f1e15b96c0001760e1201",
  "guest_count": 4,
  "note": "Cần ghế trẻ em"
}
```

`status` bắt buộc là `available`, `occupied` hoặc `reserved`.

- Với `occupied`, có thể gửi thêm `order_id`, `guest_count`, `note`.
- Với `reserved`, có thể gửi thêm `reservation_id`, `guest_count`, `note`.
- Với `available`, backend xóa liên kết order/reservation và từ chối nếu bàn còn hóa đơn pending.

Khi cập nhật thành công server emit Socket.io event `table_status_updated`:

```js
socket.on('table_status_updated', ({ tableId, newStatus, branchId }) => {
  if (branchId === currentBranchId) refreshTableLayout();
});
```

## Axios client và xử lý lỗi

```js
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function getApiErrorMessage(error) {
  return error.response?.data?.message || 'Không thể kết nối đến máy chủ';
}
```

Các lỗi thường gặp:

| HTTP | `message` | Ý nghĩa |
| --- | --- | --- |
| 401 | `Missing or invalid authorization header` | Thiếu token hoặc token sai. |
| 403 | `You can only view table layout for your own branch` | Nhân viên không thuộc chi nhánh của bàn. |
| 404 | `Table not found` | `tableId` không tồn tại. |
| 404 | `No pending order found for this table` | Bàn chưa có hóa đơn pending. |
| 503 | `Database service is temporarily unavailable` | MongoDB không sẵn sàng. |

## API chưa được triển khai

Frontend **không nên gọi** các endpoint sau cho đến khi backend bổ sung:

- `POST /orders/:orderId/change-table`
- `POST /reservations/:reservationId/check-in`
- `PATCH /reservations/:reservationId/status`
