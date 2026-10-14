const hostedMedia = new WeakMap<object, string>();

/** Only server-authorized objects keep this marker; it does not survive JSON or cloning. */
export const registerModelHostedMedia = <T extends { url: string }>(media: T): T => {
  hostedMedia.set(media, media.url);
  return media;
};

export const isModelHostedMedia = (media: { url: string }) => {
  const registered = hostedMedia.get(media);
  return registered !== undefined && registered === media.url;
};
