# BusyBox/POSIX awk only: the standalone nginx image has no Node.js runtime.
function json(value,    result, i, ch) {
    result = "\""
    for (i = 1; i <= length(value); i++) {
        ch = substr(value, i, 1)
        if (ch in escape) result = result escape[ch]
        else result = result ch
    }
    return result "\""
}

BEGIN {
    escape["\\"] = "\\\\"
    escape["\""] = "\\\""
    for (i = 1; i < 32; i++) escape[sprintf("%c", i)] = sprintf("\\u%04x", i)
    # Only these public build-time placeholders may enter browser assets.
    values["KANEO_API_URL"] = ENVIRON["KANEO_API_URL"]
    values["KANEO_CLIENT_URL"] = ENVIRON["KANEO_CLIENT_URL"]
    values["KANEO_TURNSTILE_SITE_KEY"] = ENVIRON["KANEO_TURNSTILE_SITE_KEY"]

    if (mode == "resource" || mode == "authorization") {
        base = values["KANEO_API_URL"]
        if (base == "") { print "{}"; exit }
        sub(/[?#].*$/, "", base)
        sub(/\/*$/, "", base)
        sub(/\/api$/, "", base)
        if (mode == "resource") {
            print "{\"resource\":" json(base "/api/mcp") ",\"authorization_servers\":[" json(base "/api") "]}"
        } else {
            print "{\"issuer\":" json(base "/api") ",\"authorization_endpoint\":" json(base "/api/mcp/authorize") ",\"token_endpoint\":" json(base "/api/mcp/token") ",\"registration_endpoint\":" json(base "/api/mcp/register") ",\"response_types_supported\":[\"code\"],\"grant_types_supported\":[\"authorization_code\"],\"code_challenge_methods_supported\":[\"S256\"],\"token_endpoint_auth_methods_supported\":[\"none\"]}"
        }
        exit
    }
}

{
    rest = $0
    output = ""
    # Match entire quoted literals. The emitted JSON string is never scanned
    # again, so a value containing another placeholder remains literal data.
    # Vite can fold a static path suffix into the same literal (for example
    # KANEO_CLIENT_URL/auth/sign-in). Only accept an unescaped static path.
    while (match(rest, /["'`]KANEO_(API_URL|CLIENT_URL|TURNSTILE_SITE_KEY)(\/[-A-Za-z0-9_.\/]*)?["'`]/)) {
        token = substr(rest, RSTART, RLENGTH)
        key = substr(token, 2, length(token) - 2)
        suffix = ""
        slash = index(key, "/")
        if (slash) { suffix = substr(key, slash); key = substr(key, 1, slash - 1) }
        output = output substr(rest, 1, RSTART - 1)
        if (substr(token, 1, 1) == substr(token, length(token), 1)) output = output json(values[key] suffix)
        else output = output token
        rest = substr(rest, RSTART + RLENGTH)
    }
    print output rest
}
