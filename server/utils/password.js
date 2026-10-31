// More than 8 characters, with uppercase, lowercase and a special character
function validPassword(p) {
  return (
    typeof p === "string" &&
    p.length > 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /[^A-Za-z0-9]/.test(p)
  );
}

const PASSWORD_MESSAGE =
  "Password must be more than 8 characters with an uppercase letter, a lowercase letter and a special character.";

module.exports = { validPassword, PASSWORD_MESSAGE };
