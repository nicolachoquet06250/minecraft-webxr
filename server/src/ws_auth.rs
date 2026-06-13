use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

#[derive(Debug, Clone)]
pub struct AuthenticatedWebSocketClient {
    pub user_id: String,
}

#[derive(Debug, Deserialize)]
struct JwtClaims {
    sub: Option<String>,
    user_id: Option<String>,
    id: Option<String>,
    exp: usize,
}

pub fn validate_websocket_jwt(
    token: &str,
    secret: &str,
) -> Result<AuthenticatedWebSocketClient, String> {
    let normalized_token = token
        .trim()
        .strip_prefix("Bearer ")
        .unwrap_or_else(|| token.trim())
        .trim();

    if normalized_token.is_empty() {
        return Err("token_missing".to_string());
    }

    if secret.trim().is_empty() {
        return Err("jwt_secret_missing".to_string());
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.leeway = 30;

    let token_data = decode::<JwtClaims>(
        normalized_token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|_| "token_invalid".to_string())?;

    let claims = token_data.claims;
    let user_id = claims
        .sub
        .or(claims.user_id)
        .or(claims.id)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "token_user_missing".to_string())?;

    let _ = claims.exp;

    Ok(AuthenticatedWebSocketClient { user_id })
}
