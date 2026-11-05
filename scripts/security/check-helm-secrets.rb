require 'yaml'
require 'open3'
require 'json'

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
runtime_mount = deployment['spec']['template']['spec']['containers'].first.fetch('volumeMounts').find { |mount| mount['mountPath'] == '/var/lib/kaneo' }
verify(runtime_mount && !runtime_mount['readOnly'], 'Kaneo runtime storage must be writable')
runtime_volume = deployment['spec']['template']['spec'].fetch('volumes').find { |volume| volume['name'] == runtime_mount['name'] }
verify(runtime_volume && runtime_volume['emptyDir'] == {}, 'Kaneo runtime storage must use emptyDir')
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

extra_volume = { 'name' => 'identity', 'projected' => { 'sources' => [{ 'serviceAccountToken' => { 'audience' => 'identity.example', 'path' => 'token' } }] } }
extra_mount = { 'name' => 'identity', 'mountPath' => '/var/run/identity', 'readOnly' => true }
labels = { 'identity.example/enabled' => 'true', 'app.kubernetes.io/name' => 'wrong', 'app.kubernetes.io/component' => 'wrong' }
extended = render(*args,
  '--set-json', "podLabels=#{JSON.generate(labels)}",
  '--set-json', "extraVolumes=#{JSON.generate([extra_volume])}",
  '--set-json', "kaneo.extraVolumeMounts=#{JSON.generate([extra_mount])}")
deployment = extended.find { |item| item['kind'] == 'Deployment' && !item['metadata']['name'].end_with?('-postgresql') }
pod = deployment.fetch('spec').fetch('template')
verify(pod.dig('metadata', 'labels', 'identity.example/enabled') == 'true', 'Additional Pod label was not rendered')
verify(pod.dig('metadata', 'labels', 'app.kubernetes.io/component') == 'kaneo', 'Extra labels must not replace the component label')
verify(deployment.dig('spec', 'selector', 'matchLabels').all? { |key, value| pod.dig('metadata', 'labels', key) == value }, 'Extra labels must not change workload selectors')
verify(pod.dig('spec', 'volumes').include?(extra_volume), 'Extra projected volume was not rendered')
verify(pod.dig('spec', 'containers').first.fetch('volumeMounts').include?(extra_mount), 'Extra read-only mount was not rendered')
verify(pod.dig('spec', 'volumes').include?({ 'name' => 'runtime', 'emptyDir' => {} }), 'Extra volumes must not remove writable runtime storage')
puts 'Helm Pod labels and additional volume checks passed'
