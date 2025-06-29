const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        console.log("User:", req.user);

      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Utilisateur non authentifié ou rôle manquant"
        });
      }
      next();
    };
  };

  module.exports = { authorizeRoles };
