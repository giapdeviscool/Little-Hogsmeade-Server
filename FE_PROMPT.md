# Frontend Implementation Guide: Decoupled Order & Payment Flow

## Overview
We have refactored our backend to decouple order creation from payment settlement. Previously, the system expected the order creation and payment to happen in a single step. Now, you must create a `pending` order first to generate a unique `invoice._id`, which is required for QR code generation and cash settlement tracking.

Please update the POS frontend (`POSPage.tsx` and related components) to implement this new flow:

## 1. Initial Checkout (Create Pending Order)
- When the Cashier clicks the **"Thanh toán"** (Checkout) button, immediately send a request to `POST /api/orders`.
- **Note:** You no longer need to pass `paymentMethod` in this request payload.
- The API will return the newly created `order` (with status `pending`) and `invoice` (with status `unpaid`).
- Store the `order._id`, `invoice._id`, and `invoice.totalAmount` in your component's state.

## 2. Show Payment Methods Modal
- Display the Payment options modal/section to the cashier.

## 3. Handle Cash Payment
If the Cashier selects **Cash Payment**:
- Call `POST /api/payments/cash-settle` with the payload:
  ```json
  {
    "invoice_id": "<invoice._id>",
    "cash_received": <number>
  }
  ```
- **On Success:** Replace the pending statement with a success message, show the calculated `change_due` returned by the API, close the modal, and clear the cart.
- **On Error:** Show the corresponding error message.

## 4. Handle Bank Transfer (QR Code Payment)
If the Cashier selects **Bank Transfer (QR Code)**:
- Call `POST /api/payments/qr-intent` with the payload:
  ```json
  {
    "invoice_id": "<invoice._id>",
    "amount": <invoice.totalAmount>
  }
  ```
- Use the `data.qrCodeUrl` from the API response to display the SepayQR image to the customer.
- **WebSocket Listener:** Listen on the global WebSocket for the event `payment_success_${invoice._id}`.
- **On Socket Event Received:** This means the bank webhook has successfully verified the transfer. Replace the pending statement with a success message, close the QR modal, and clear the cart.
- **On Error/Timeout:** Show an error/timeout message and provide a way to cancel or retry.
