export const sanitizaDetails = (data) => {
    if (!data) return null;

    const sanitized = { ...data };
    
    const forbidden = [
        "password",
        "confirmPassword",
        "newPassword",
        "oldPassword",
        "token"
    ]

    for (const field of forbidden) {
            if (field in sanitized) {
                delete sanitized[field];
            }
        }
    
        return sanitized;
    };