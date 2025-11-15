const jwt = require('jsonwebtoken');

const SECRET = process.env.SECRET || "MY_SUPER_SECRET_CHANGE_ME";

const payload = {
  user: "client",
  iat: Math.floor(Date.now() / 1000)
};

const token = jwt.sign(payload, SECRET);

console.log("YOUR TOKEN:\n");
console.log(token + "\n");

console.log("VIEW URL:");
console.log("http://localhost:3000/view?token=" + token);
