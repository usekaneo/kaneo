#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)

fail() {
	printf 'share metadata regression: %s\n' "$1" >&2
	exit 1
}

assert_contains() {
	file=$1
	text=$2
	grep -F -- "$text" "$repo_root/$file" >/dev/null ||
		fail "$file does not contain: $text"
}

assert_response_contains() {
	file=$1
	text=$2
	grep -F -- "$text" "$file" >/dev/null ||
		fail "response does not contain: $text"
}

check_static_contract() {
	assert_contains apps/web/index.html "<title>Kaneo - All you need. Nothing you don't.</title>"
	assert_contains apps/web/index.html '<meta property="og:url" content="https://kaneo.app">'
	assert_contains apps/web/index.html '<link rel="canonical" href="https://kaneo.app">'
	if grep -F '__KANEO_SHARE_' "$repo_root/apps/web/index.html" >/dev/null; then
		fail 'source index.html contains a share metadata placeholder'
	fi
	assert_contains apps/web/share-metadata.conf 'map $request_uri $kaneo_share_title'
	assert_contains apps/web/share-metadata.conf 'map $request_uri $kaneo_share_request_uri'
	assert_contains apps/web/share-metadata.conf 'map $http_x_forwarded_proto $kaneo_forwarded_scheme'
	assert_contains apps/web/share-metadata.conf '"~*^[[:space:]]*https[[:space:]]*(?:,|$)" "https";'
	assert_contains apps/web/share-metadata.conf '"~*^[[:space:]]*http[[:space:]]*(?:,|$)" "http";'
	assert_contains apps/web/share-metadata.conf '"Task · Kaneo"'
	assert_contains apps/web/share-metadata.conf '"Project settings · Kaneo"'
	assert_contains apps/web/share-metadata.conf '"Account settings · Kaneo"'

	for config in apps/web/nginx.conf apps/web/nginx.kaneo.conf; do
		assert_contains "$config" "sub_filter \"Kaneo - All you need. Nothing you don't.\" '\$kaneo_share_title';"
		assert_contains "$config" "sub_filter 'content=\"https://kaneo.app\"' 'content=\"\$kaneo_share_origin\$kaneo_share_request_uri\"';"
		assert_contains "$config" "sub_filter 'href=\"https://kaneo.app\"' 'href=\"\$kaneo_share_origin\$kaneo_share_request_uri\"';"
	done

	assert_contains apps/web/Dockerfile 'apps/web/share-metadata.conf /etc/nginx/conf.d/00-share-metadata.conf'
	assert_contains Dockerfile.kaneo 'apps/web/share-metadata.conf /etc/nginx/conf.d/00-share-metadata.conf'
	assert_contains apps/web/env.sh '__KANEO_CLIENT_ORIGIN__'
	assert_contains apps/web/env.sh 'client_url_single_line='
	assert_contains apps/web/env.sh 'replace_client_url_placeholders "$metadata_origin"'
	assert_contains apps/web/src/routes/auth/sign-in.tsx 'resolveClientOrigin('
	assert_contains apps/web/src/routes/auth/sign-up.tsx 'resolveClientOrigin('
	assert_contains .github/workflows/ci.yml 'file: ./apps/web/Dockerfile'
	assert_contains .github/workflows/ci.yml 'tests/deployment/share-metadata.test.sh'
}

container_name="kaneo-share-metadata-$$"
response_dir=""
base_url=""

cleanup() {
	docker rm -f "$container_name" >/dev/null 2>&1 || true
	if [ -n "$response_dir" ]; then
		rm -rf "$response_dir"
	fi
}

wait_for_nginx() {
	attempt=0
	until curl --fail --silent --show-error \
		-H 'Host: request.example.test:5173' \
		-o /dev/null "$base_url/"; do
		attempt=$((attempt + 1))
		if [ "$attempt" -ge 30 ]; then
			docker logs "$container_name" >&2
			fail 'nginx did not become ready'
		fi
		sleep 1
	done
}

start_image() {
	image=$1
	client_url=$2
	docker run --detach \
		--name "$container_name" \
		--publish 127.0.0.1::5173 \
		--env "KANEO_CLIENT_URL=$client_url" \
		--entrypoint /bin/sh \
		"$image" \
		-c '/docker-entrypoint.d/env.sh && nginx -t && exec nginx -g "daemon off;"' >/dev/null
	base_url="http://$(docker port "$container_name" 5173/tcp)"
	wait_for_nginx
}

fetch() {
	path=$1
	output=$2
	host=${3:-request.example.test:5173}
	forwarded_proto=${4:-}
	if [ -n "$forwarded_proto" ]; then
		curl --fail --silent --show-error \
			-H "Host: $host" \
			-H "X-Forwarded-Proto: $forwarded_proto" \
			-o "$output" "$base_url$path"
	else
		curl --fail --silent --show-error \
			-H "Host: $host" \
			-o "$output" "$base_url$path"
	fi
}

check_runtime_contract() {
	image=$1
	command -v docker >/dev/null || fail 'docker is required for the runtime regression'
	command -v curl >/dev/null || fail 'curl is required for the runtime regression'

	response_dir=$(mktemp -d)
	trap cleanup EXIT INT TERM

	start_image "$image" 'https://preview.example.test/'

	task_path='/dashboard/workspace/workspace-id/project/project-id/task/task-id?view=details&mode=compact'
	fetch "$task_path" "$response_dir/task.html"
	assert_response_contains "$response_dir/task.html" '<title>Task · Kaneo</title>'
	assert_response_contains "$response_dir/task.html" '<meta name="title" content="Task · Kaneo">'
	assert_response_contains "$response_dir/task.html" '<meta property="og:title" content="Task · Kaneo">'
	assert_response_contains "$response_dir/task.html" '<meta property="twitter:title" content="Task · Kaneo">'
	assert_response_contains "$response_dir/task.html" "<meta property=\"og:url\" content=\"https://preview.example.test$task_path\">"
	assert_response_contains "$response_dir/task.html" "<meta property=\"twitter:url\" content=\"https://preview.example.test$task_path\">"
	assert_response_contains "$response_dir/task.html" "<link rel=\"canonical\" href=\"https://preview.example.test$task_path\">"
	if grep -F '__KANEO_SHARE_' "$response_dir/task.html" >/dev/null; then
		fail 'served response retains a share metadata token'
	fi

	fetch '/dashboard/settings/projects/project-id/general' "$response_dir/project-settings.html"
	assert_response_contains "$response_dir/project-settings.html" '<title>Project settings · Kaneo</title>'

	fetch '/dashboard/settings/account/information' "$response_dir/account-settings.html"
	assert_response_contains "$response_dir/account-settings.html" '<title>Account settings · Kaneo</title>'

	fetch '/dashboard/workspace/workspace-id/project/project-id/board' "$response_dir/board.html"
	assert_response_contains "$response_dir/board.html" '<title>Project board · Kaneo</title>'

	fetch '/dashboard/workspace/workspace-id/project/project-id/backlog' "$response_dir/backlog.html"
	assert_response_contains "$response_dir/backlog.html" '<title>Project backlog · Kaneo</title>'

	fetch '/dashboard/settings/workspace/general' "$response_dir/workspace-settings.html"
	assert_response_contains "$response_dir/workspace-settings.html" '<title>Workspace settings · Kaneo</title>'

	fetch '/invitation/accept/invitation-id' "$response_dir/invitation.html"
	assert_response_contains "$response_dir/invitation.html" '<title>Invitation · Kaneo</title>'

	fetch '/unknown-route' "$response_dir/unknown.html"
	assert_response_contains "$response_dir/unknown.html" "<title>Kaneo - All you need. Nothing you don't.</title>"

	docker rm -f "$container_name" >/dev/null
	start_image "$image" 'https://invalid.example.test/path;include'

	fetch '/auth/sign-in?next=%2Fdashboard' "$response_dir/request-origin.html" 'request.example.test:5173' 'https'
	assert_response_contains "$response_dir/request-origin.html" '<title>Sign in · Kaneo</title>'
	assert_response_contains "$response_dir/request-origin.html" '<meta property="og:url" content="https://request.example.test:5173/auth/sign-in?next=%2Fdashboard">'

	fetch '/auth/sign-in' "$response_dir/forwarded-list.html" 'request.example.test:5173' 'HTTPS, http'
	assert_response_contains "$response_dir/forwarded-list.html" '<meta property="og:url" content="https://request.example.test:5173/auth/sign-in">'

	if docker exec "$container_name" grep -R -F 'KANEO_CLIENT_URL' /usr/share/nginx/html >/dev/null; then
		fail 'invalid client URL leaves the frontend placeholder in the bundle'
	fi

	fetch '/auth/sign-in' "$response_dir/unsafe-scheme.html" 'request.example.test:5173' 'javascript'
	assert_response_contains "$response_dir/unsafe-scheme.html" '<meta property="og:url" content="http://request.example.test:5173/auth/sign-in">'
	if grep -F 'javascript://' "$response_dir/unsafe-scheme.html" >/dev/null; then
		fail 'served response reflects an unsafe forwarded scheme'
	fi

	fetch '/auth/sign-in' "$response_dir/unsafe-host.html" 'unsafe_host'
	assert_response_contains "$response_dir/unsafe-host.html" '<meta property="og:url" content="http://localhost/auth/sign-in">'

	curl --fail --silent --show-error \
		-H 'Host: request.example.test:5173' \
		--request-target '/auth/sign-in?next="><script>alert(1)</script>' \
		-o "$response_dir/unsafe-uri.html" "$base_url/"
	assert_response_contains "$response_dir/unsafe-uri.html" '<meta property="og:url" content="http://request.example.test:5173/">'
	if grep -F '<script>alert(1)</script>' "$response_dir/unsafe-uri.html" >/dev/null; then
		fail 'served response reflects an unsafe request target'
	fi

	docker rm -f "$container_name" >/dev/null
	multiline_client_url=$(printf 'https://preview.example.test\ninclude /tmp/evil.conf;')
	start_image "$image" "$multiline_client_url"
	fetch '/auth/sign-in' "$response_dir/multiline-origin.html" 'request.example.test:5173' 'https'
	assert_response_contains "$response_dir/multiline-origin.html" '<meta property="og:url" content="https://request.example.test:5173/auth/sign-in">'
}

check_static_contract

if [ "$#" -eq 1 ]; then
	check_runtime_contract "$1"
elif [ "$#" -ne 0 ]; then
	fail 'usage: share-metadata.test.sh [docker-image]'
fi

printf 'share metadata regression: ok\n'
