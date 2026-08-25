import config from "../config";
import { redisClient } from "./redis";

export const getBkashIdTone = async () => {
  try {
    const IdTokenKey = "bkash:id_token";
    const RefreshTokenKey = "bkash:refresh_token";

    let bkashIdToken = await redisClient.get(IdTokenKey);
    const bkashIdTokenTTL = await redisClient.ttl(IdTokenKey);

    let bkashRefreshToken = await redisClient.get(RefreshTokenKey);

    if (bkashIdTokenTTL <= 600 && bkashRefreshToken) {
      const refreshTokenResponse = await fetch(
        `${config.bkash_base_url}/tokenized/checkout/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            username: config.bkash_username,
            password: config.bkash_password,
          },
          body: JSON.stringify({
            app_key: config.bkash_app_key,
            app_secret: config.bkash_app_secret,
            refresh_token: bkashRefreshToken,
          }),
        },
      );
      const bkashRefreshTokenResult = await refreshTokenResponse.json();


      bkashIdToken = bkashRefreshTokenResult.id_token as string;

      await redisClient.set(IdTokenKey, bkashIdToken, {
        expiration: {
          type: "EX",// type
          value: 3600, // 1 hour
        },
      });

      return bkashIdToken;
    }

    if (bkashIdToken) {
      return bkashIdToken;
    }

    const response = await fetch(
      `${config.bkash_base_url}/tokenized/checkout/token/grant`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          username: config.bkash_username,
          password: config.bkash_password,
        },
        body: JSON.stringify({
          app_key: config.bkash_app_key,
          app_secret: config.bkash_app_secret,
        }),
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch bKash ID token");
    }

    const result = await response.json();

    // Bkash Id token set
    await redisClient.set(IdTokenKey, result.id_token, {
      expiration: {
        type: "EX",
        value: 3600, // 1 hour
      },
    });

    // Bkash Refresh token set
    await redisClient.set(RefreshTokenKey, result.refresh_token, {
      expiration: {
        type: "EX",
        value: 3600 * 24 * 28, // 28 days
      },
    });

    bkashIdToken = result.id_token;

    return bkashIdToken;
  } catch (error: any) {
    throw new Error(`Error fetching bKash ID token: ${error.message}`);
  }
};
