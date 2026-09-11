type CloudinaryTransform = {
  width?: number;
  height?: number;
  crop?: "fill" | "fit" | "limit" | "scale";
};

export const cloudinaryDeliveryUrl = (
  publicId: string,
  resourceType: "image" | "video" | "raw" = "image",
  transform: CloudinaryTransform = {},
) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !publicId) return undefined;

  const parts = ["f_auto", "q_auto"];
  if (transform.width) parts.push(`w_${Math.max(1, Math.round(transform.width))}`);
  if (transform.height) parts.push(`h_${Math.max(1, Math.round(transform.height))}`);
  if (transform.crop) parts.push(`c_${transform.crop}`);

  return `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/${resourceType}/upload/${parts.join(",")}/${publicId}`;
};