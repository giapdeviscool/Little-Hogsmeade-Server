var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
var errorUtils = require('./src/utils/error');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./src/routes');

var app = express();

app.use(logger('dev'));
app.use(cors());
app.use(express.json({
  verify: function (req, res, buf) {
    if (req.originalUrl && req.originalUrl.includes('webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/v1', apiRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  var normalizedError = errorUtils.normalizeError(err);
  var statusCode = normalizedError.statusCode;
  var payload = normalizedError.payload;

  errorUtils.logError(err, req);

  if (req.app.get('env') === 'development' && statusCode >= 500 && !errorUtils.isDatabaseError(err)) {
    payload.error = err;
  }

  res.status(statusCode).json(payload);
});

module.exports = app;
