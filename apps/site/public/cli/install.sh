#!/bin/sh

set -u

setup_colors() {
  if [ -t 1 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-}" != "dumb" ]; then
    bold=$(printf '\033[1m')
    dim=$(printf '\033[2m')
    red=$(printf '\033[31m')
    green=$(printf '\033[32m')
    yellow=$(printf '\033[33m')
    reset=$(printf '\033[0m')
  else
    bold=''
    dim=''
    red=''
    green=''
    yellow=''
    reset=''
  fi
}

say() {
  printf '%s\n' "$*"
}

warn() {
  printf '%swarning:%s %s\n' "$yellow" "$reset" "$*"
}

fail() {
  printf '%serror:%s %s\n' "$red" "$reset" "$*" >&2
  exit 1
}

cleanup() {
  if [ -n "${staged:-}" ] && [ -f "$staged" ]; then
    rm -f "$staged"
  fi
  if [ -n "${tmp_dir:-}" ] && [ -d "$tmp_dir" ]; then
    rm -rf "$tmp_dir"
  fi
}

is_musl() {
  if getconf GNU_LIBC_VERSION >/dev/null 2>&1; then
    return 1
  fi
  if ldd --version 2>&1 | grep -qi musl; then
    return 0
  fi
  for loader in /lib/ld-musl-*.so.1; do
    if [ -e "$loader" ]; then
      return 0
    fi
  done
  return 1
}

has_libstdcxx() {
  for lib in /usr/lib/libstdc++.so.6 /lib/libstdc++.so.6 /usr/local/lib/libstdc++.so.6; do
    if [ -e "$lib" ]; then
      return 0
    fi
  done
  if command -v ldconfig >/dev/null 2>&1 && ldconfig -p 2>/dev/null | grep -q 'libstdc++\.so\.6'; then
    return 0
  fi
  return 1
}

detect_platform() {
  kernel=$(uname -s 2>/dev/null || echo unknown)
  machine=$(uname -m 2>/dev/null || echo unknown)

  case $kernel in
    Darwin) os=darwin ;;
    Linux) os=linux ;;
    MINGW* | MSYS* | CYGWIN* | Windows_NT)
      fail "This script does not run on Windows. Open PowerShell and run: irm https://kaneo.app/cli/install.ps1 | iex"
      ;;
    *) fail "Unsupported operating system: $kernel. The Kaneo CLI is available for macOS, Linux and Windows." ;;
  esac

  case $machine in
    x86_64 | amd64 | x64) arch=x64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) fail "Unsupported CPU architecture: $machine. The Kaneo CLI is available for x64 and arm64." ;;
  esac

  if [ "$os" = darwin ] && [ "$arch" = x64 ]; then
    translated=$(sysctl -n sysctl.proc_translated 2>/dev/null || true)
    if [ "$translated" = 1 ]; then
      arch=arm64
    fi
  fi

  libc=''
  missing_libstdcxx=''
  if [ "$os" = linux ] && is_musl; then
    libc=-musl
    if ! has_libstdcxx; then
      missing_libstdcxx=1
    fi
  fi

  asset="kaneo-$os-$arch$libc"
}

need_tools() {
  if command -v curl >/dev/null 2>&1; then
    downloader=curl
  elif command -v wget >/dev/null 2>&1; then
    downloader=wget
  else
    fail "Neither curl nor wget is installed. Install one of them and run the installer again."
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    hasher=sha256sum
  elif command -v shasum >/dev/null 2>&1; then
    hasher=shasum
  else
    fail "Neither sha256sum nor shasum is installed, so the download cannot be verified. Install one of them and run the installer again."
  fi
}

download() {
  download_error=''
  if [ "$downloader" = curl ]; then
    status=$(curl -fsSL --retry 2 -w '%{http_code}' -o "$2" "$1" 2>"$tmp_dir/download.err")
    code=$?
    if [ "$code" -eq 0 ]; then
      return 0
    fi
    if [ "$status" = 404 ] || [ "$code" -eq 37 ]; then
      return 2
    fi
  else
    wget -q -O "$2" "$1" 2>"$tmp_dir/download.err"
    code=$?
    if [ "$code" -eq 0 ]; then
      return 0
    fi
    if [ "$code" -eq 8 ] || grep -q '404' "$tmp_dir/download.err"; then
      return 2
    fi
  fi
  download_error=$(sed -n '1p' "$tmp_dir/download.err")
  return 1
}

sha256_of() {
  if [ "$hasher" = sha256sum ]; then
    sha256sum "$1" | awk '{ print tolower($1) }'
  else
    shasum -a 256 "$1" | awk '{ print tolower($1) }'
  fi
}

latest_cli_version() {
  awk '
    function value(part) {
      sub(/^[^:]*:[ \t]*/, "", part)
      gsub(/[" \t\r]/, "", part)
      return part
    }
    function inspect(part) {
      if (part ~ /^[ \t]*"tag_name"[ \t]*:/) tag = value(part)
      else if (part ~ /^[ \t]*"draft"[ \t]*:/) draft = value(part)
      else if (part ~ /^[ \t]*"prerelease"[ \t]*:/) pre = value(part)
      else return
      if (tag == "" || draft == "" || pre == "") return
      if (tag ~ /^cli-v[0-9][0-9A-Za-z.+-]*$/ && draft == "false" && pre == "false") print substr(tag, 6)
      tag = ""
      draft = ""
      pre = ""
    }
    {
      count = split($0, parts, /[,{}]/)
      for (i = 1; i <= count; i++) inspect(parts[i])
    }
  ' | sort -t . -k 1,1n -k 2,2n -k 3,3n | tail -n 1
}

resolve_version() {
  requested=${KANEO_VERSION:-}
  if [ -n "$requested" ]; then
    version=${requested#cli-v}
    version=${version#v}
    case $version in
      '' | *[!0-9A-Za-z.+-]*) fail "KANEO_VERSION is not a valid version: $requested. Use a version such as 0.1.0." ;;
      *) ;;
    esac
    return 0
  fi

  if [ -n "${KANEO_DOWNLOAD_URL:-}" ]; then
    fail "KANEO_VERSION is required when KANEO_DOWNLOAD_URL is set, for example KANEO_VERSION=0.1.0."
  fi

  say "${dim}Looking up the latest Kaneo CLI release...${reset}"
  releases_file="$tmp_dir/releases.json"
  page=1
  while [ "$page" -le 3 ]; do
    if ! download "https://api.github.com/repos/usekaneo/kaneo/releases?per_page=100&page=$page" "$releases_file"; then
      fail "Could not look up the latest release on GitHub. Check your internet connection, or set KANEO_VERSION to skip the lookup. Without a token GitHub allows 60 lookups per hour."
    fi
    version=$(latest_cli_version <"$releases_file")
    if [ -n "$version" ]; then
      return 0
    fi
    if ! grep -q '"tag_name"' "$releases_file"; then
      break
    fi
    page=$((page + 1))
  done

  fail "No Kaneo CLI release found on GitHub. See https://github.com/usekaneo/kaneo/releases or set KANEO_VERSION."
}

prepare_install_dir() {
  install_dir=${KANEO_INSTALL_DIR:-}
  if [ -z "$install_dir" ]; then
    if [ -z "${HOME:-}" ]; then
      fail "HOME is not set. Set KANEO_INSTALL_DIR to the directory to install kaneo into."
    fi
    install_dir="$HOME/.local/bin"
  fi

  case $install_dir in
    \~) install_dir=$HOME ;;
    \~/*) install_dir="$HOME/${install_dir#??}" ;;
    *) ;;
  esac

  if ! mkdir -p "$install_dir" 2>/dev/null; then
    fail "Could not create $install_dir. Set KANEO_INSTALL_DIR to a directory you can write to."
  fi
  if ! install_dir=$(CDPATH='' cd -- "$install_dir" && pwd); then
    fail "Could not open $install_dir."
  fi
  if [ ! -w "$install_dir" ]; then
    fail "$install_dir is not writable. Set KANEO_INSTALL_DIR to a directory you can write to."
  fi

  target="$install_dir/kaneo"
  if [ -d "$target" ]; then
    fail "$target is a directory. Remove it or set KANEO_INSTALL_DIR to another directory."
  fi
}

installed_version_from() {
  found_version=$(printf '%s\n' "$1" | sed -n 's/.*"version"[ ]*:[ ]*"\([^"]*\)".*/\1/p' | sed -n '1p')
  if [ -z "$found_version" ]; then
    found_version=$(printf '%s\n' "$1" | awk 'NF { print $NF; exit }')
  fi
  printf '%s\n' "${found_version#v}"
}

install_binary() {
  if [ -n "${KANEO_DOWNLOAD_URL:-}" ]; then
    base_url=${KANEO_DOWNLOAD_URL%/}
  else
    base_url="https://github.com/usekaneo/kaneo/releases/download"
  fi
  release_url="$base_url/cli-v$version"
  sums_url="$release_url/SHA256SUMS"
  asset_url="$release_url/$asset"

  say "Installing ${bold}kaneo $version${reset} for $os $arch${libc:+ (musl)}"
  say "${dim}From $asset_url${reset}"

  sums_file="$tmp_dir/SHA256SUMS"
  download "$sums_url" "$sums_file"
  case $? in
    0) ;;
    2) fail "Kaneo CLI $version was not found: $sums_url does not exist. Check the version at https://github.com/usekaneo/kaneo/releases." ;;
    *) fail "Could not download $sums_url${download_error:+ ($download_error)}. Check your internet connection and try again." ;;
  esac

  expected=$(awk -v name="$asset" '$2 == name || $2 == "*" name { print tolower($1); exit }' "$sums_file")
  if [ -z "$expected" ]; then
    fail "Kaneo CLI $version has no build named $asset. Check https://github.com/usekaneo/kaneo/releases for the files it provides."
  fi
  case $expected in
    *[!0-9a-f]*) fail "SHA256SUMS has an invalid checksum for $asset." ;;
    *) ;;
  esac
  if [ "${#expected}" -ne 64 ]; then
    fail "SHA256SUMS has an invalid checksum for $asset."
  fi

  if ! staged=$(mktemp "$install_dir/.kaneo.XXXXXX"); then
    staged=''
    fail "Could not create a temporary file in $install_dir."
  fi

  download "$asset_url" "$staged"
  case $? in
    0) ;;
    2) fail "Kaneo CLI $version is missing the $asset file: $asset_url was not found." ;;
    *) fail "Could not download $asset_url${download_error:+ ($download_error)}. Check your internet connection and try again." ;;
  esac

  actual=$(sha256_of "$staged")
  if [ "$actual" != "$expected" ]; then
    fail "Checksum mismatch for $asset: expected $expected, got $actual. The download is corrupted or was changed, so nothing was installed."
  fi

  if ! chmod 755 "$staged"; then
    fail "Could not make $staged executable."
  fi

  version_output=''
  if [ -z "$missing_libstdcxx" ] && ! version_output=$("$staged" --version </dev/null 2>&1); then
    fail "The downloaded kaneo does not run on this system, so nothing was installed.${version_output:+ Output: $version_output}"
  fi

  if ! mv -f "$staged" "$target"; then
    fail "Could not move kaneo into $install_dir."
  fi
  staged=''

  installed_version=$(installed_version_from "$version_output")
  say "${green}Installed${reset} ${bold}kaneo ${installed_version:-$version}${reset} to $target"
}

path_contains() {
  case ":${PATH:-}:" in
    *":$1:"* | *":$1/:"*) return 0 ;;
    *) return 1 ;;
  esac
}

escape_for() {
  case $1 in
    fish) printf '%s' "$2" | sed 's/[\\"$]/\\&/g' ;;
    *) printf '%s' "$2" | sed 's/[\\"`$]/\\&/g' ;;
  esac
}

dir_for() {
  if [ -n "${HOME:-}" ]; then
    case $install_dir in
      "$HOME"/*)
        printf "\$HOME/%s" "$(escape_for "$1" "${install_dir#"$HOME"/}")"
        return 0
        ;;
      *) ;;
    esac
  fi
  escape_for "$1" "$install_dir"
}

append_command() {
  line="export PATH=\"$(dir_for sh):\$PATH\""
  quoted_line=$(printf '%s' "$line" | sed "s/'/'\\\\''/g")
  printf "printf '%%s\\\\n' '%s' >> ~/%s" "$quoted_line" "$1"
}

print_path_help() {
  shell_name=$(basename -- "${SHELL:-sh}")
  case $shell_name in
    fish)
      path_command="fish_add_path \"$(dir_for fish)\""
      ;;
    zsh)
      path_command=$(append_command .zshrc)
      ;;
    bash)
      if [ "$os" = darwin ]; then
        path_command=$(append_command .bash_profile)
      else
        path_command=$(append_command .bashrc)
      fi
      ;;
    *)
      path_command=$(append_command .profile)
      ;;
  esac

  say ""
  say "$install_dir is not on your PATH. To add it, run:"
  say ""
  say "  ${bold}$path_command${reset}"
  say ""
  say "Then open a new terminal."
}

check_shadowing() {
  found=$(command -v kaneo 2>/dev/null) || return 0
  case $found in
    /*) ;;
    *) return 0 ;;
  esac
  found_dir=$(CDPATH='' cd -- "$(dirname -- "$found")" 2>/dev/null && pwd -P) || return 0
  own_dir=$(CDPATH='' cd -- "$install_dir" 2>/dev/null && pwd -P) || return 0
  if [ "$found_dir/$(basename -- "$found")" = "$own_dir/kaneo" ]; then
    return 0
  fi

  say ""
  if [ "$1" = on_path ]; then
    warn "Another kaneo comes first on your PATH: $found"
    warn "Typing kaneo runs that one, not $target. It may be an older community CLI. Remove it, or put $install_dir earlier in your PATH."
  else
    warn "Another kaneo is on your PATH: $found"
    warn "Typing kaneo runs that one until $install_dir is at the front of your PATH. It may be an older community CLI that you can remove."
  fi
}

finish() {
  if [ -n "$missing_libstdcxx" ]; then
    say ""
    warn "kaneo needs the libstdc++ library, which was not found on this system. On Alpine, install it with:"
    say ""
    say "  ${bold}apk add libstdc++${reset}"
  fi
  if path_contains "$install_dir"; then
    check_shadowing on_path
  else
    print_path_help
    check_shadowing off_path
  fi
  say ""
  say "Run ${bold}kaneo login${reset} to sign in, or ${bold}kaneo --help${reset} to see every command."
}

main() {
  staged=''
  tmp_dir=''
  trap cleanup EXIT
  trap 'exit 129' HUP
  trap 'exit 130' INT
  trap 'exit 143' TERM

  setup_colors
  detect_platform
  need_tools

  if ! tmp_dir=$(mktemp -d 2>/dev/null); then
    tmp_dir=''
    fail "Could not create a temporary directory."
  fi

  resolve_version
  prepare_install_dir
  install_binary
  finish
}

main "$@"
