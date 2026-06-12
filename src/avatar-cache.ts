const CENTRAL_AVATAR_BASE_URL = "https://central.voxicraft.fr/avatars";
const AVATAR_CACHE_NAME = "voxicraft-avatar-cache-v1";
const DEFAULT_AVATARS = ["steve", "alex"] as const;

const objectUrls = new Map<string, string>();

export function resolveAvatarUrl(avatar: string | undefined | null): string {
  const normalizedAvatar = avatar?.trim() || "steve";

  if (normalizedAvatar === "steve" || normalizedAvatar === "alex") {
    return `${CENTRAL_AVATAR_BASE_URL}/${normalizedAvatar}.png`;
  }

  if (
    normalizedAvatar.startsWith("http://")
    || normalizedAvatar.startsWith("https://")
    || normalizedAvatar.startsWith("/")
  ) {
    return normalizedAvatar;
  }

  return `${CENTRAL_AVATAR_BASE_URL}/${encodeURIComponent(normalizedAvatar)}.png`;
}

export async function resolveCachedAvatarUrl(avatar: string | undefined | null): Promise<string> {
  const avatarUrl = resolveAvatarUrl(avatar);

  if (!("caches" in window)) {
    return avatarUrl;
  }

  const existingObjectUrl = objectUrls.get(avatarUrl);

  if (existingObjectUrl) {
    return existingObjectUrl;
  }

  try {
    const cache = await window.caches.open(AVATAR_CACHE_NAME);
    let response = await cache.match(avatarUrl);

    if (!response) {
      const fetchedResponse = await fetch(avatarUrl, {
        mode: "cors",
        cache: "force-cache",
      });

      if (!fetchedResponse.ok) {
        return avatarUrl;
      }

      await cache.put(avatarUrl, fetchedResponse.clone());
      response = fetchedResponse;
    }

    const objectUrl = URL.createObjectURL(await response.blob());
    objectUrls.set(avatarUrl, objectUrl);
    return objectUrl;
  } catch {
    return avatarUrl;
  }
}

export function warmDefaultAvatarCache(): void {
  for (const avatar of DEFAULT_AVATARS) {
    void resolveCachedAvatarUrl(avatar);
  }
}
