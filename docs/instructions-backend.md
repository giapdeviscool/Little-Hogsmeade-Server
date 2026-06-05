# Little Hogsmeade — Backend Development Instructions

## 📁 Backend Structure

```
Little-Hogsmeade-Server/
├── src/
│   ├── config/                 # Configuration files
│   │   ├── env.js              # Environment variables
│   │   └── resources.js        # Resource definitions
│   ├── controllers/            # Route controllers
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   └── resource.controller.js
│   ├── lib/                    # Libraries
│   │   └── prisma.js           # Prisma client instance
│   ├── middlewares/            # Express middlewares
│   │   └── validate.middleware.js
│   ├── repositories/           # Data access layer
│   │   ├── auth.repository.js
│   │   ├── user.repository.js
│   │   └── resource.repository.js
│   ├── routes/                 # Route definitions
│   │   ├── index.js            # Main router
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   └── resource.routes.js
│   ├── services/               # Business logic layer
│   │   ├── auth.service.js
│   │   ├── user.service.js
│   │   └── resource.service.js
│   ├── utils/                  # Utility functions
│   │   ├── error.js            # Error handling
│   │   └── response.js         # Response formatting
│   └── validators/             # Input validation schemas
│       ├── auth.validator.js
│       └── user.validator.js
├── prisma/
│   └── schema.prisma           # Prisma schema (MongoDB)
├── routes/                     # Legacy routes (index, users)
│   ├── index.js
│   └── users.js
├── public/                     # Static files
├── bin/
│   └── www                     # Server entry point
├── app.js                      # Express app setup
├── .env.example                # Environment template
├── docker-compose.local.yml    # Local MongoDB setup
└── package.json                # Dependencies
```

---

## ⚙️ Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 4.16
- **Language**: JavaScript ES6+ (KHÔNG dùng TypeScript)
- **Database**: MongoDB
- **ORM**: Prisma 5.22
- **Authentication**: Custom JWT implementation (NO external library)
- **Password Hashing**: Node crypto (scrypt)
- **Validation**: Custom validator middleware
- **Logging**: Morgan
- **Dev Tools**: Nodemon cho hot reload

---

## 📝 Code Style & Conventions

### ⚠️ QUAN TRỌNG: Variable Declarations

**Project này sử dụng `var` CONSISTENTLY. KHÔNG refactor sang `const`/`let`.**

```javascript
// ✅ ĐÚNG: Dùng var
var express = require('express');
var authService = require('../services/auth.service');
var prisma = require('../lib/prisma');

function register(req, res, next) {
  var payload = req.body;
  var email = payload.email.trim();
  // ...
}

async function createOrder(data) {
  var order = await orderRepository.create(data);
  var items = data.items;
  return order;
}

// ❌ SAI: Không mix const/let trong codebase này
const express = require('express');  // ❌
let payload = req.body;               // ❌
const result = await service.login(); // ❌
```

**Lý do:**
- Maintain consistency với existing codebase
- Tất cả files hiện tại đều dùng `var`
- Tránh inconsistency khi review code

### File Naming

```
✅ ĐÚNG:
- Controllers: camelCase.controller.js → auth.controller.js
- Services: camelCase.service.js → auth.service.js
- Repositories: camelCase.repository.js → auth.repository.js
- Routes: camelCase.routes.js → auth.routes.js
- Middlewares: camelCase.middleware.js → validate.middleware.js
- Utils: camelCase.js → error.js, response.js
- Validators: camelCase.validator.js → auth.validator.js

❌ SAI:
- PascalCase → AuthController.js, UserService.js
- Kebab-case → auth-controller.js, user-service.js
- No suffix → auth.js (trong src/ folders)
```

### Module Pattern

```javascript
// ✅ ĐÚNG: CommonJS với module.exports
var express = require('express');
var authController = require('../controllers/auth.controller');

function register(req, res, next) {
  // ...
}

function login(req, res, next) {
  // ...
}

module.exports = {
  register: register,
  login: login
};

// ❌ SAI: ES6 imports (project không support)
import express from 'express';  // ❌
export function register() { }   // ❌
export default { register };     // ❌
```

---

## 🏗️ Architecture Pattern: Repository → Service → Controller

### Layer Responsibilities

#### 1️⃣ Repository Layer (Data Access)

**Vai trò:** ONLY database operations, NO business logic

```javascript
// src/repositories/auth.repository.js
var prisma = require('../lib/prisma');

function findCustomerByPhone(phone) {
  return prisma.customer.findUnique({
    where: { phone: phone }
  });
}

function findCustomerByEmail(email) {
  if (!email) {
    return Promise.resolve(null);
  }
  return prisma.customer.findUnique({
    where: { email: email }
  });
}

function createCustomer(data) {
  return prisma.customer.create({
    data: data
  });
}

function updateCustomer(id, data) {
  return prisma.customer.update({
    where: { id: id },
    data: data
  });
}

module.exports = {
  findCustomerByPhone: findCustomerByPhone,
  findCustomerByEmail: findCustomerByEmail,
  createCustomer: createCustomer,
  updateCustomer: updateCustomer
};
```

**Quy tắc Repository:**
- ✅ Chỉ chứa Prisma operations
- ✅ Return Promises (async/await)
- ✅ Simple queries, no complex logic
- ❌ KHÔNG có business validation
- ❌ KHÔNG transform data
- ❌ KHÔNG throw custom errors (để Prisma errors bubble up)

#### 2️⃣ Service Layer (Business Logic)

**Vai trò:** Business logic, validation, data transformation

```javascript
// src/services/auth.service.js
var crypto = require('crypto');
var env = require('../config/env');
var authRepository = require('../repositories/auth.repository');

var TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function register(payload) {
  var accountType = payload.accountType || 'customer';
  
  // Normalize input
  var phone = payload.phone.trim();
  var email = payload.email ? payload.email.trim().toLowerCase() : null;
  var fullName = payload.fullName.trim();
  
  // Business validation: Check if identifier already exists
  await assertIdentifierAvailable(phone, email);
  
  // Create account based on type
  if (accountType === 'employee') {
    return registerEmployee(payload, { phone: phone, email: email, fullName: fullName });
  }
  
  return registerCustomer(payload, { phone: phone, email: email, fullName: fullName });
}

async function login(payload) {
  var identifier = normalizeIdentifier(payload.identifier || payload.email || payload.phone);
  
  // Find account
  var account = await findAccountByIdentifier(identifier);
  
  // Validate credentials
  if (!account || !account.record.passwordHash) {
    throwHttpError(401, 'Invalid identifier or password');
  }
  
  if (!verifyPassword(payload.password, account.record.passwordHash)) {
    throwHttpError(401, 'Invalid identifier or password');
  }
  
  // Create auth response
  return createAuthResponse(account.type, account.record);
}

async function registerCustomer(payload, commonData) {
  var customer = await authRepository.createCustomer({
    phone: commonData.phone,
    fullName: commonData.fullName,
    email: commonData.email,
    avatarUrl: payload.avatarUrl || null,
    birthday: parseOptionalDate(payload.birthday),
    source: payload.source || 'online-register',
    passwordHash: hashPassword(payload.password)
  });
  
  return createAuthResponse('customer', customer);
}

async function assertIdentifierAvailable(phone, email) {
  var existingByPhone = await authRepository.findCustomerByPhone(phone)
    || await authRepository.findEmployeeByPhone(phone);
  
  if (existingByPhone) {
    throwHttpError(409, 'Phone already registered');
  }
  
  if (email) {
    var existingByEmail = await authRepository.findCustomerByEmail(email)
      || await authRepository.findEmployeeByEmail(email);
    
    if (existingByEmail) {
      throwHttpError(409, 'Email already registered');
    }
  }
}

function createAuthResponse(accountType, account) {
  return {
    accountType: accountType,
    user: sanitizeAccount(accountType, account),
    token: signToken({
      sub: account.id,
      type: accountType,
      phone: account.phone,
      email: account.email || null
    })
  };
}

function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, passwordHash) {
  var parts = passwordHash.split(':');
  if (parts.length !== 2) return false;
  
  var salt = parts[0];
  var storedHash = Buffer.from(parts[1], 'hex');
  var hash = crypto.scryptSync(password, salt, 64);
  
  return storedHash.length === hash.length && crypto.timingSafeEqual(storedHash, hash);
}

function signToken(payload) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'HS256', typ: 'JWT' };
  var body = Object.assign({}, payload, {
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  });
  
  var encodedHeader = base64Url(JSON.stringify(header));
  var encodedBody = base64Url(JSON.stringify(body));
  var signature = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(encodedHeader + '.' + encodedBody)
    .digest('base64url');
  
  return encodedHeader + '.' + encodedBody + '.' + signature;
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  register: register,
  login: login
};
```

**Quy tắc Service:**
- ✅ Business validation và logic
- ✅ Data transformation và sanitization
- ✅ Call repository methods
- ✅ Throw custom errors với statusCode
- ✅ Return clean data structures
- ❌ KHÔNG có HTTP handling (res.json, res.status)
- ❌ KHÔNG direct Prisma calls

#### 3️⃣ Controller Layer (HTTP Handling)

**Vai trò:** HTTP request/response handling

```javascript
// src/controllers/auth.controller.js
var authService = require('../services/auth.service');

async function register(req, res, next) {
  try {
    var result = await authService.register(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    var result = await authService.login(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getProfile(req, res, next) {
  try {
    var userId = req.user.id;  // From auth middleware
    var profile = await authService.getProfile(userId);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register: register,
  login: login,
  getProfile: getProfile
};
```

**Quy tắc Controller:**
- ✅ Try/catch wrapper cho async functions
- ✅ Call service methods
- ✅ Send responses: `res.json({ data: result })`
- ✅ Pass errors to Express: `next(error)`
- ✅ Extract data từ req (body, params, query, user)
- ❌ KHÔNG có business logic
- ❌ KHÔNG call repository trực tiếp
- ❌ KHÔNG handle errors manually (let global handler do it)

#### 4️⃣ Route Layer (Endpoint Definition)

```javascript
// src/routes/auth.routes.js
var express = require('express');
var authController = require('../controllers/auth.controller');
var validate = require('../middlewares/validate.middleware');
var authValidator = require('../validators/auth.validator');

var router = express.Router();

router.post('/register', 
  validate(authValidator.registerSchema), 
  authController.register
);

router.post('/login', 
  validate(authValidator.loginSchema), 
  authController.login
);

router.get('/profile',
  authenticate,  // Auth middleware
  authController.getProfile
);

module.exports = router;
```

**Quy tắc Routes:**
- ✅ Define endpoints với HTTP methods
- ✅ Apply middlewares (validation, auth, etc.)
- ✅ Mount controllers
- ✅ Export router
- ❌ KHÔNG có business logic trong routes

---

## 🔧 Error Handling Pattern

### Centralized Error Handler

```javascript
// src/utils/error.js

function isDatabaseError(error) {
  if (!error) return false;
  
  return Boolean(
    error.name === 'PrismaClientKnownRequestError' ||
    error.name === 'PrismaClientInitializationError' ||
    error.name === 'PrismaClientUnknownRequestError' ||
    error.code === 'P1001' ||
    error.code === 'P2010' ||
    /server selection timeout|connection refused|database server/i.test(error.message || '')
  );
}

function normalizeError(error) {
  if (isDatabaseError(error)) {
    return {
      statusCode: 503,
      payload: {
        message: 'Database service is temporarily unavailable',
        code: 'DATABASE_UNAVAILABLE'
      }
    };
  }
  
  return {
    statusCode: error.status || error.statusCode || 500,
    payload: {
      message: error.message || 'Internal server error'
    }
  };
}

function logError(error, req) {
  if (isDatabaseError(error)) {
    console.error(
      '[database]',
      req.method,
      req.originalUrl,
      'code=' + (error.code || 'CONNECTION_ERROR'),
      'message=' + getDatabaseLogMessage(error)
    );
    return;
  }
  
  if ((error.status || error.statusCode || 500) >= 500) {
    console.error('[server]', req.method, req.originalUrl, error.stack || error.message);
  }
}

module.exports = {
  isDatabaseError: isDatabaseError,
  normalizeError: normalizeError,
  logError: logError
};
```

### Global Error Handler in app.js

```javascript
// app.js
var errorUtils = require('./src/utils/error');

// ... other middlewares

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  var normalizedError = errorUtils.normalizeError(err);
  var statusCode = normalizedError.statusCode;
  var payload = normalizedError.payload;
  
  errorUtils.logError(err, req);
  
  // Expose error details in development for 5xx errors
  if (req.app.get('env') === 'development' && statusCode >= 500 && !errorUtils.isDatabaseError(err)) {
    payload.error = err;
  }
  
  res.status(statusCode).json(payload);
});
```

### Throwing Errors in Service

```javascript
// Service method
function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

async function createOrder(payload) {
  // Validation
  if (!payload.items || payload.items.length === 0) {
    throwHttpError(400, 'Order must have at least one item');
  }
  
  // Check stock availability
  var product = await productRepository.findById(payload.productId);
  if (!product) {
    throwHttpError(404, 'Product not found');
  }
  
  if (product.stock < payload.quantity) {
    throwHttpError(409, 'Insufficient stock');
  }
  
  // Create order
  var order = await orderRepository.create(payload);
  return order;
}
```

**Quy tắc Error Handling:**
- ✅ Throw errors với `throwHttpError(statusCode, message)`
- ✅ Tất cả errors pass qua `next(error)` trong controller
- ✅ Global handler normalize và log errors
- ✅ Database errors → 503 với generic message
- ✅ 4xx errors: client mistakes (validation, not found, conflict)
- ✅ 5xx errors: server issues (database down, unexpected errors)
- ❌ KHÔNG expose stack traces trong production
- ❌ KHÔNG throw strings, chỉ Error objects
- ❌ KHÔNG handle errors manually trong controller

---

## 📤 Response Format Standards

### Success Responses

```javascript
// ✅ Single resource (200 OK)
{
  "data": {
    "id": "usr_123",
    "name": "Anha Nguyen",
    "email": "anha@example.com"
  }
}

// ✅ List of resources (200 OK)
{
  "data": [
    { "id": "1", "name": "Product 1" },
    { "id": "2", "name": "Product 2" }
  ]
}

// ✅ Created resource (201 Created)
{
  "data": {
    "id": "order_456",
    "status": "pending",
    "total": 120000
  }
}

// ✅ No content (204 No Content)
// Empty body

// Controller usage
async function getUser(req, res, next) {
  try {
    var user = await userService.getUserById(req.params.id);
    res.json({ data: user });  // 200 OK by default
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    var user = await userService.createUser(req.body);
    res.status(201).json({ data: user });  // 201 Created
  } catch (error) {
    next(error);
  }
}
```

### Error Responses

```javascript
// ✅ Client errors (400-499)
{
  "message": "Phone already registered",
  "code": "CONFLICT"  // Optional
}

// ✅ Validation error (400)
{
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" },
    { "field": "password", "message": "Password must be at least 6 characters" }
  ]
}

// ✅ Server errors (500-599)
{
  "message": "Database service is temporarily unavailable",
  "code": "DATABASE_UNAVAILABLE"
}
```

**Quy tắc Response:**
- ✅ Success: `{ data: T }` structure
- ✅ Error: `{ message: string, code?: string }`
- ✅ HTTP status codes:
  - 200 OK: success
  - 201 Created: resource created
  - 204 No Content: success with no body
  - 400 Bad Request: validation errors
  - 401 Unauthorized: authentication failed
  - 403 Forbidden: authorization failed
  - 404 Not Found: resource not found
  - 409 Conflict: duplicate resource
  - 500 Internal Server Error: unexpected error
  - 503 Service Unavailable: database down
- ❌ KHÔNG dùng `success: true/false` field
- ❌ KHÔNG wrap error trong data field

---

## 🗄️ Database Patterns with Prisma

### Prisma Client Setup

```javascript
// src/lib/prisma.js
var { PrismaClient } = require('@prisma/client');

var prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error']
});

module.exports = prisma;
```

### Repository Patterns

```javascript
// ✅ Find operations
function findUserById(id) {
  return prisma.user.findUnique({
    where: { id: id }
  });
}

function findUsersByRole(role) {
  return prisma.user.findMany({
    where: { role: role },
    orderBy: { createdAt: 'desc' }
  });
}

function findOrdersWithItems(branchId) {
  return prisma.order.findMany({
    where: { branchId: branchId },
    include: {
      customer: true,
      orderItems: {
        include: {
          menuItem: true
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

// ✅ Create operations
function createOrder(data) {
  return prisma.order.create({
    data: data,
    include: {
      customer: true,
      orderItems: true
    }
  });
}

// ✅ Update operations
function updateOrderStatus(orderId, status) {
  return prisma.order.update({
    where: { id: orderId },
    data: { 
      status: status,
      updatedAt: new Date()
    }
  });
}

// ✅ Delete operations
function deleteOrder(orderId) {
  return prisma.order.delete({
    where: { id: orderId }
  });
}

// ✅ Transactions
async function createOrderWithItems(orderData, itemsData) {
  return prisma.$transaction(async (tx) => {
    // Create order
    var order = await tx.order.create({ 
      data: orderData 
    });
    
    // Create order items
    var items = await tx.orderItem.createMany({
      data: itemsData.map(function(item) {
        return {
          orderId: order.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.quantity * item.unitPrice
        };
      })
    });
    
    // Update stock
    for (var i = 0; i < itemsData.length; i++) {
      await tx.ingredient.update({
        where: { id: itemsData[i].ingredientId },
        data: {
          currentStock: {
            decrement: itemsData[i].quantityRequired
          }
        }
      });
    }
    
    return { order: order, items: items };
  });
}

// ✅ Aggregations
function getOrderStatsByBranch(branchId, startDate, endDate) {
  return prisma.order.aggregate({
    where: {
      branchId: branchId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: { id: true },
    _sum: { totalAmount: true },
    _avg: { totalAmount: true }
  });
}
```

**Quy tắc Prisma:**
- ✅ Repository layer ONLY contains Prisma calls
- ✅ Dùng `include` để eager load relations khi cần
- ✅ Dùng `select` để giới hạn fields khi query lớn
- ✅ Transactions (`$transaction`) cho multi-step operations
- ✅ Handle Prisma errors trong error.js utility
- ✅ Return Promises (async/await)
- ❌ KHÔNG để raw Prisma calls trong service/controller
- ❌ KHÔNG over-fetch data (avoid N+1 queries)
- ❌ KHÔNG forget await (common mistake)

---

## 🔐 Authentication & Security

### JWT Implementation (NO external library)

```javascript
// Custom JWT implementation
function signToken(payload) {
  var now = Math.floor(Date.now() / 1000);
  var header = { alg: 'HS256', typ: 'JWT' };
  var body = Object.assign({}, payload, {
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  });
  
  var encodedHeader = base64Url(JSON.stringify(header));
  var encodedBody = base64Url(JSON.stringify(body));
  var signature = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(encodedHeader + '.' + encodedBody)
    .digest('base64url');
  
  return encodedHeader + '.' + encodedBody + '.' + signature;
}

function verifyToken(token) {
  var parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  var encodedHeader = parts[0];
  var encodedBody = parts[1];
  var signature = parts[2];
  
  // Verify signature
  var expectedSignature = crypto
    .createHmac('sha256', env.jwtSecret)
    .update(encodedHeader + '.' + encodedBody)
    .digest('base64url');
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }
  
  // Decode payload
  var payload = JSON.parse(Buffer.from(encodedBody, 'base64url').toString());
  
  // Check expiration
  var now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error('Token expired');
  }
  
  return payload;
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}
```

### Password Hashing với scrypt

```javascript
function hashPassword(password) {
  var salt = crypto.randomBytes(16).toString('hex');
  var hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, passwordHash) {
  var parts = passwordHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  
  var salt = parts[0];
  var storedHash = Buffer.from(parts[1], 'hex');
  var hash = crypto.scryptSync(password, salt, 64);
  
  return storedHash.length === hash.length && crypto.timingSafeEqual(storedHash, hash);
}
```

### Auth Middleware

```javascript
// src/middlewares/auth.middleware.js
var authService = require('../services/auth.service');

function authenticate(req, res, next) {
  try {
    var authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing or invalid authorization header' });
    }
    
    var token = authHeader.substring(7);
    var payload = authService.verifyToken(token);
    
    // Attach user info to request
    req.user = {
      id: payload.sub,
      type: payload.type,
      phone: payload.phone,
      email: payload.email
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
```

**Quy tắc Security:**
- ✅ JWT token với 7 days expiry
- ✅ Password hashing với scrypt (NOT bcrypt)
- ✅ Salt + hash format: `salt:hash`
- ✅ Timing-safe password comparison (`crypto.timingSafeEqual`)
- ✅ JWT secret từ environment variable
- ✅ Bearer token trong Authorization header
- ❌ KHÔNG store plain passwords
- ❌ KHÔNG expose sensitive data trong responses
- ❌ KHÔNG log passwords/tokens
- ❌ KHÔNG hardcode JWT secret

---

## ✅ Validation Pattern

### Validator Schema

```javascript
// src/validators/auth.validator.js
var registerSchema = {
  fullName: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  phone: {
    required: true,
    type: 'string',
    pattern: /^(0[3|5|7|8|9])+([0-9]{8})$/
  },
  email: {
    required: false,
    type: 'string',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    required: true,
    type: 'string',
    minLength: 6
  },
  accountType: {
    required: false,
    type: 'string',
    enum: ['customer', 'employee']
  }
};

var loginSchema = {
  identifier: {
    required: true,
    type: 'string'
  },
  password: {
    required: true,
    type: 'string'
  }
};

module.exports = {
  registerSchema: registerSchema,
  loginSchema: loginSchema
};
```

### Validation Middleware

```javascript
// src/middlewares/validate.middleware.js
function validate(schema) {
  return function(req, res, next) {
    var errors = validateSchema(req.body, schema);
    
    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors
      });
    }
    
    next();
  };
}

function validateSchema(data, schema) {
  var errors = [];
  
  for (var field in schema) {
    var rules = schema[field];
    var value = data[field];
    
    // Required check
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: field,
        message: field + ' is required'
      });
      continue;
    }
    
    // Skip further validation if not required and empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Type check
    if (rules.type && typeof value !== rules.type) {
      errors.push({
        field: field,
        message: field + ' must be a ' + rules.type
      });
      continue;
    }
    
    // String validations
    if (rules.type === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push({
          field: field,
          message: field + ' must be at least ' + rules.minLength + ' characters'
        });
      }
      
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push({
          field: field,
          message: field + ' must not exceed ' + rules.maxLength + ' characters'
        });
      }
      
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field: field,
          message: field + ' has invalid format'
        });
      }
      
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({
          field: field,
          message: field + ' must be one of: ' + rules.enum.join(', ')
        });
      }
    }
    
    // Number validations
    if (rules.type === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field: field,
          message: field + ' must be at least ' + rules.min
        });
      }
      
      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field: field,
          message: field + ' must not exceed ' + rules.max
        });
      }
    }
  }
  
  return errors;
}

module.exports = validate;
```

**Quy tắc Validation:**
- ✅ Validate tại route middleware level
- ✅ Return 400 với structured validation errors
- ✅ Phone regex cho số VN: `/^(0[3|5|7|8|9])+([0-9]{8})$/`
- ✅ Email regex basic: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- ✅ Validate type, required, length, pattern, enum
- ❌ KHÔNG skip validation cho "trusted" inputs
- ❌ KHÔNG validate business logic (để service layer)

---

## 🌍 Environment Variables

### Configuration File

```javascript
// src/config/env.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-key-change-in-production',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173'
};
```

### .env.example Template

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=mongodb://localhost:27017/little-hogsmeade

# Authentication
JWT_SECRET=your-secret-key-here-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Usage in Code

```javascript
var env = require('../config/env');

console.log('Server running on port:', env.port);
console.log('Environment:', env.nodeEnv);

// JWT signing
var signature = crypto
  .createHmac('sha256', env.jwtSecret)
  .update(data)
  .digest('base64url');
```

**Quy tắc Environment:**
- ✅ Tất cả secrets phải trong .env
- ✅ Provide fallbacks cho development
- ✅ Validate required env vars tại startup
- ✅ .env.example luôn up-to-date
- ✅ Use env.js để centralize access
- ❌ KHÔNG commit .env vào git
- ❌ KHÔNG hardcode secrets trong code
- ❌ KHÔNG dùng process.env directly (dùng env.js)

---

## 🚀 Development Commands

```bash
# Install dependencies
npm install

# Development server with nodemon (http://localhost:3000)
npm run dev

# Production server
npm start

# Prisma commands
npm run prisma:generate  # Generate Prisma Client
npm run prisma:push      # Push schema to database (dev)
npm run prisma:studio    # Open Prisma Studio GUI
```

---

## 📋 Development Checklist

### Before Creating Feature

- [ ] Feature map to: Repository → Service → Controller → Routes
- [ ] Database schema updated (if needed)
- [ ] Validation schema defined
- [ ] Error scenarios identified

### Implementation

- [ ] Repository: Only Prisma operations
- [ ] Service: Business logic isolated
- [ ] Controller: try/catch + next(error)
- [ ] Routes: middlewares applied (validation, auth)
- [ ] Validation middleware before controller
- [ ] Error handling với statusCode
- [ ] Response format standardized `{ data: T }`

### Code Quality

- [ ] Dùng `var` consistently
- [ ] No const/let mixed in
- [ ] Function names descriptive
- [ ] No business logic trong controller
- [ ] No Prisma calls trong service
- [ ] Passwords hashed
- [ ] Sensitive data not logged
- [ ] Environment variables used

---

## 🚫 Common Mistakes to Avoid

### ❌ KHÔNG làm:

```javascript
// Mix const/let với var
var express = require('express');
const authService = require('./service');  // ❌
let result = await service.login();        // ❌

// Business logic trong controller
async function createOrder(req, res) {
  var order = await prisma.order.create({ data: req.body });  // ❌
  var points = Math.floor(order.total / 10000);  // ❌ Business logic
  res.json({ data: order });
}

// Direct Prisma trong service
async function getUser(id) {
  return prisma.user.findUnique({ where: { id: id } });  // ❌
}

// No error handling
async function login(req, res) {
  var result = await authService.login(req.body);  // ❌ No try/catch
  res.json({ data: result });
}

// Expose errors
catch (error) {
  res.json({ error: error.stack });  // ❌
}

// No validation
router.post('/register', authController.register);  // ❌
```

### ✅ NÊN làm:

```javascript
// Consistent var usage
var express = require('express');
var authService = require('./service');
var result = await service.login();

// Business logic trong service
async function createOrder(orderData) {
  var order = await orderRepository.create(orderData);
  var points = calculateLoyaltyPoints(order.total);
  await loyaltyService.addPoints(order.customerId, points);
  return order;
}

// Prisma chỉ trong repository
async function getUser(id) {
  return userRepository.findById(id);
}

// Proper error handling
async function login(req, res, next) {
  try {
    var result = await authService.login(req.body);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
}

// Normalized errors
catch (error) {
  next(error);  // Let global handler deal with it
}

// With validation
router.post('/register', 
  validate(authValidator.registerSchema),
  authController.register
);
```

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `app.js` | Express app setup + global error handler |
| `bin/www` | Server entry point (starts HTTP server) |
| `src/lib/prisma.js` | Prisma client singleton |
| `src/utils/error.js` | Error handling utilities |
| `src/utils/response.js` | Response formatting helpers |
| `src/config/env.js` | Environment variables configuration |
| `src/routes/index.js` | Main router mounting all sub-routes |
| `prisma/schema.prisma` | Database schema definition |
| `.env.example` | Environment variables template |

---

## 📖 Common Patterns Reference

### Creating New Resource API

1. **Update Prisma Schema** (if new model)
```prisma
model Product {
  id        String   @id @default(auto()) @map("_id") @db.ObjectId
  name      String
  price     Float
  stock     Int
  createdAt DateTime @default(now()) @map("created_at")
  
  @@map("products")
}
```

2. **Create Repository**
```javascript
// src/repositories/product.repository.js
var prisma = require('../lib/prisma');

function findAll() {
  return prisma.product.findMany();
}

function findById(id) {
  return prisma.product.findUnique({ where: { id: id } });
}

function create(data) {
  return prisma.product.create({ data: data });
}

function update(id, data) {
  return prisma.product.update({ where: { id: id }, data: data });
}

function deleteById(id) {
  return prisma.product.delete({ where: { id: id } });
}

module.exports = {
  findAll: findAll,
  findById: findById,
  create: create,
  update: update,
  deleteById: deleteById
};
```

3. **Create Service**
```javascript
// src/services/product.service.js
var productRepository = require('../repositories/product.repository');

async function getAll() {
  return productRepository.findAll();
}

async function getById(id) {
  var product = await productRepository.findById(id);
  if (!product) {
    throwHttpError(404, 'Product not found');
  }
  return product;
}

async function create(payload) {
  // Validation
  if (payload.price < 0) {
    throwHttpError(400, 'Price must be positive');
  }
  
  return productRepository.create(payload);
}

async function update(id, payload) {
  await getById(id);  // Check exists
  return productRepository.update(id, payload);
}

async function deleteById(id) {
  await getById(id);  // Check exists
  return productRepository.deleteById(id);
}

function throwHttpError(statusCode, message) {
  var error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

module.exports = {
  getAll: getAll,
  getById: getById,
  create: create,
  update: update,
  deleteById: deleteById
};
```

4. **Create Controller**
```javascript
// src/controllers/product.controller.js
var productService = require('../services/product.service');

async function getAll(req, res, next) {
  try {
    var products = await productService.getAll();
    res.json({ data: products });
  } catch (error) {
    next(error);
  }
}

async function getById(req, res, next) {
  try {
    var product = await productService.getById(req.params.id);
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
}

async function create(req, res, next) {
  try {
    var product = await productService.create(req.body);
    res.status(201).json({ data: product });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    var product = await productService.update(req.params.id, req.body);
    res.json({ data: product });
  } catch (error) {
    next(error);
  }
}

async function deleteById(req, res, next) {
  try {
    await productService.deleteById(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll: getAll,
  getById: getById,
  create: create,
  update: update,
  deleteById: deleteById
};
```

5. **Create Validator**
```javascript
// src/validators/product.validator.js
var createSchema = {
  name: {
    required: true,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  price: {
    required: true,
    type: 'number',
    min: 0
  },
  stock: {
    required: true,
    type: 'number',
    min: 0
  }
};

var updateSchema = {
  name: {
    required: false,
    type: 'string',
    minLength: 2,
    maxLength: 100
  },
  price: {
    required: false,
    type: 'number',
    min: 0
  },
  stock: {
    required: false,
    type: 'number',
    min: 0
  }
};

module.exports = {
  createSchema: createSchema,
  updateSchema: updateSchema
};
```

6. **Create Routes**
```javascript
// src/routes/product.routes.js
var express = require('express');
var productController = require('../controllers/product.controller');
var validate = require('../middlewares/validate.middleware');
var productValidator = require('../validators/product.validator');
var authenticate = require('../middlewares/auth.middleware');

var router = express.Router();

router.get('/', authenticate, productController.getAll);
router.get('/:id', authenticate, productController.getById);
router.post('/', authenticate, validate(productValidator.createSchema), productController.create);
router.put('/:id', authenticate, validate(productValidator.updateSchema), productController.update);
router.delete('/:id', authenticate, productController.deleteById);

module.exports = router;
```

7. **Mount Routes**
```javascript
// src/routes/index.js
var express = require('express');
var authRoutes = require('./auth.routes');
var productRoutes = require('./product.routes');

var router = express.Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);

module.exports = router;
```

---

## 🎯 Code Philosophy

- **Consistency over convention** — Follow existing patterns (`var`, module structure)
- **Simplicity over complexity** — Avoid over-engineering
- **Separation of concerns** — Repository ≠ Service ≠ Controller
- **Explicit over implicit** — Clear function names, no magic
- **Standards over shortcuts** — Proper error handling, validation

---

*Tài liệu này là source of truth cho Backend development trong Little Hogsmeade project.*

**Last Updated**: June 2026
