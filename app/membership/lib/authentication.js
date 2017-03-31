var events = require("events");
var util = require("util");
var assert = require("assert");
var bc = require("bcrypt-nodejs");
var User = require("../models/user");
var Log = require("../models/log");

var AuthResult = function(creds) {
  var result = {
    creds: creds,
    success: false,
    message: "Invalid email or password",
    user: null,
    log: null
  };
  return result;
};

var Authentication = function (db) {
    var self = this;
    var continueWith = null;
    events.EventEmitter.call(self);

    // Validate Creds
    var validateCredentials = function (authResult) {
      if (authResult.creds.email && authResult.creds.password) {
        self.emit("creds-ok", authResult);
      } else {
        self.emit("invalid", authResult);
      }
    };
    // Find The User
    var findUser = function (authResult) {
      db.users.first({email: authResult.creds.email}, function (err, found) {
        assert.ok(err === null, err);
        if (found) {
          authResult.user = new User(found);
          self.emit("user-found", authResult);
        } else {
          self.emit("invalid", authResult);
        }
      })
    };
    // Compare The Password
    var comparePassword = function (authResult) {
      var matched = bc.compareSync(authResult.creds.password, authResult.user.hashedPassword);
      if (matched) {
        self.emit("password-accepted", authResult);
      } else {
        self.emit("invalid", authResult);
      }
    };
    // Bump The Stats
    var updateUserStats = function (authResult) {
      var user = authResult.user;
      user.signInCount += 1;
      user.lastLoginAt = user.currentLoginAt;
      user.currentLoginAt = new Date();

      var updates = {
        signInCount: user.signInCount,
        lastLoginAt: user.lastLoginAt,
        currentLoginAt: user.currentLoginAt
      };
      db.users.updateOnly(updates, authResult.user.id, function (err, updates) {
        assert.ok(err === null, err);
        self.emit("stats-updated", authResult);
      });
    };
    // Create a Log Entry
    var createLog = function (authResult) {
      var log = new Log({
        subject: "Authentication",
        userId: authResult.user.id,
        entry: "Successfully logged in"
      });
      db.logs.save(log, function (err, newLog) {
        authResult.log = newLog;
        self.emit("log-created", authResult);
      });

    };
    // Authentication OK
    var authOk = function (authResult) {
      authResult.success = true;
      authResult.message = "Welcome!";
      self.emit("authenticated", authResult);
      self.emit("completed", authResult);
      if (continueWith) {
        continueWith(null, authResult);
      }
    };
    // Authentication Failed
    var authNotOk = function (authResult) {
      authResult.success = false;
      self.emit("not-authenticated", authResult);
      self.emit("completed", authResult);
      if (continueWith) {
        continueWith(null, authResult);
      }
    };

    self.on("login-received", validateCredentials);
    self.on("creds-ok", findUser);
    self.on("user-found", comparePassword);
    self.on("password-accepted", updateUserStats);
    self.on("stats-updated", createLog);
    self.on("log-created", authOk);

    self.on("invalid", authNotOk);

    self.authenticate = function(creds, next) {
      continueWith = next;
      var authResult = new AuthResult(creds);
      self.emit("login-received", authResult);
    };
};
util.inherits(Authentication, events.EventEmitter);
module.exports = Authentication;