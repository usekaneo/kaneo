require 'yaml'
require 'open3'

def render(*args)
  stdout, stderr, status = Open3.capture3('helm', 'template', 'security-test', 'charts/kaneo', *args)
  raise stderr unless status.success?
  YAML.load_stream(stdout).compact
end

def verify(condition, message)
  raise message unless condition
end

def app_env(docs)
  deployment = docs.find { |d| d['kind'] == 'Deployment' && !d['metadata']['name'].end_with?('-postgresql') }
  deployment.fetch('spec').fetch('template').fetch('spec').fetch('containers').first.fetch('env')
end

secret = 'test-auth-secret-at-least-32-characters'
args = ['--set', "kaneo.env.authSecret=#{secret}", '--set', 'kaneo.env.clientUrl=https://kaneo.example.com']
first = render(*args)
second = render(*args, '--is-upgrade')
[first, second].each do |docs|
  env = app_env(docs).find { |e| e['name'] == 'AUTH_SECRET' }
  verify(!env.key?('value'), 'AUTH_SECRET must not be a literal in the Deployment')
  ref = env.fetch('valueFrom').fetch('secretKeyRef')
  resource = docs.find { |d| d['kind'] == 'Secret' && d['metadata']['name'] == ref['name'] }
  verify(resource.fetch('stringData').fetch(ref['key']) == secret, 'Secret value must be preserved on install and upgrade')
  docs.select { |d| d['kind'] == 'Deployment' }.each do |deployment|
    verify(!deployment.to_s.include?(secret), 'Secret material leaked into a Deployment')
  end
end

external = render('--set', 'kaneo.env.clientUrl=https://kaneo.example.com', '--set', 'kaneo.env.existingSecret.enabled=true', '--set', 'kaneo.env.existingSecret.name=operator-secret')
ref = app_env(external).find { |e| e['name'] == 'AUTH_SECRET' }.fetch('valueFrom').fetch('secretKeyRef')
verify(ref == { 'name' => 'operator-secret', 'key' => 'auth-secret' }, 'Existing secret reference changed')
verify(external.none? { |d| d['kind'] == 'Secret' && d['metadata']['name'].end_with?('-auth') }, 'Existing secret must not be overwritten')
_, _, status = Open3.capture3('helm', 'template', 'security-test', 'charts/kaneo', '--set', 'kaneo.env.existingSecret.enabled=true')
verify(!status.success?, 'Missing external secret name must reject the configuration')

secured = render(*args, '--set', 'podSecurityContext.runAsNonRoot=true', '--set', 'podSecurityContext.seccompProfile.type=RuntimeDefault')
deployment = secured.find { |d| d['kind'] == 'Deployment' && !d['metadata']['name'].end_with?('-postgresql') }
context = deployment['spec']['template']['spec']['securityContext']
verify(context['runAsNonRoot'] && context.dig('seccompProfile', 'type') == 'RuntimeDefault', 'Documented pod security settings are not applied')
puts 'Helm secret, upgrade, external-secret validation and pod security checks passed'

['', '   ', 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com?x=1', 'https://example.com#fragment'].each do |url|
  _, stderr, status = Open3.capture3('helm', 'template', 'security-test', 'charts/kaneo', '--set', "kaneo.env.authSecret=#{secret}", '--set-string', "kaneo.env.clientUrl=#{url}")
  verify(!status.success? && stderr.include?('kaneo.env.clientUrl'), "Invalid clientUrl must produce an actionable error: #{url.inspect}")
end
['https://kaneo.example.com', 'http://localhost:8080', 'http://[::1]:8080/', ' https://kaneo.example.com/ '].each do |url|
  docs = render(*args, '--set-string', "kaneo.env.clientUrl=#{url}")
  client = app_env(docs).find { |env| env['name'] == 'KANEO_CLIENT_URL' }
  verify(client['value'] == url.strip.sub(%r{/$}, ''), 'Public origin must be trimmed and safe for API URL derivation')
end
puts 'Helm required-origin validation and URL rendering checks passed'
