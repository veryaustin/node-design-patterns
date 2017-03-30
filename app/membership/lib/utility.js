exports.randomString = function (stringLength) {
  stringLength = stringLength || 12;
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  var result = "";
  for (var i = 0; i < stringLength; i++) {
    var randNum = Math.floor(Math.random() * chars.length);
    result += chars.substring(randNum, randNum + 1);
  }
  return result;
};