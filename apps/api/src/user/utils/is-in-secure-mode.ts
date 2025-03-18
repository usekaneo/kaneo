export default function isInSecureMode(request: Request) {
  return request.headers.get("x-forwarded-proto") === "https";
}
