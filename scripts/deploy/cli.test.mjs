import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

test("CLI provisions then verifies the requested deployment, and fails closed on provider/HTTP failures", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "kaneo-deploy-test-"));
  try {
    cpSync(import.meta.dirname, path.join(directory, "scripts/deploy"), {
      recursive: true,
    });
    mkdirSync(path.join(directory, "deploy/digitalocean"), { recursive: true });
    writeFileSync(
      path.join(directory, "preload.mjs"),
      `
      import child from 'node:child_process';
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      let spec, updated=false, bootstrapFinished=false, reads=0;
      const scenario=process.env.SCENARIO;
      const app = () => ({ id: 'app-1', spec: spec || {name:'kaneo-production',egress:{type:'DEDICATED_IP'}}, live_url:bootstrapFinished?'https://app.example':null, dedicated_ips:[{ip:'192.0.2.1',status:'ASSIGNED'},{ip:'192.0.2.2',status:'ASSIGNED'}],
        ...(updated ? {active_deployment:{id:scenario==='wrong-active'?'old':'release-1'}} : bootstrapFinished ? {active_deployment:{id:'bootstrap'}} : scenario==='pending-bootstrap'||scenario==='existing-pending' ? {pending_deployment:{id:'bootstrap'}} : scenario==='missing-bootstrap-id'&&reads<2 ? {} : {in_progress_deployment:{id:'bootstrap'}})
      });
      child.execFileSync = (binary, args) => {
        const key = args.slice(0,2).join(' ');
        if (process.env.SCENARIO === 'provider-error' && key === 'deployment group') throw new Error('SENSITIVE_PROVIDER_ERROR');
        if (binary === 'az') {
          if (key === 'account show') return JSON.stringify({id:process.env.AZURE_SUBSCRIPTION_ID});
          if (key === 'deployment group') return JSON.stringify({properties:{outputs:{postgresHost:{value:'db.example'},redisHost:{value:'redis.example'},redisDatabaseId:{value:'/redis/default'}}}});
          if (args[0] === 'rest') return JSON.stringify({primaryKey:'private-redis-key'});
          return '{}';
        }
        if (key === 'apps list') return JSON.stringify(scenario==='existing-pending'?[app()]:[]);
        if (key === 'apps create' || key === 'apps update') {
          const file = args[args.indexOf('--spec')+1];
          if ((fs.statSync(file).mode & 0o777) !== 0o600) throw new Error('public secret file');
          spec = JSON.parse(fs.readFileSync(file));
          if(scenario==='custom-domain' && (spec.domains?.[0]?.domain!=='quills.example.com' || 'name' in spec.domains[0])) throw new Error('Invalid provider domain contract');
          if(key==='apps update') {
            const publicUrl=scenario==='custom-domain'?'https://quills.example.com':'https://app.example';
            if(spec.envs.find(e=>e.key==='KANEO_CLIENT_URL')?.value!==publicUrl) throw new Error('Wrong public URL');
            if(spec.envs.find(e=>e.key==='KANEO_API_URL')?.value!==publicUrl+'/api') throw new Error('Wrong API URL');
            updated=true;
            return JSON.stringify([{...app(),in_progress_deployment:{id:'release-1'}}]);
          }
          return JSON.stringify([app()]);
        }
        if (key === 'apps get') {reads++;return JSON.stringify([app()]);}
        if (key === 'apps get-deployment') {if(args[3]==='bootstrap')bootstrapFinished=true;return JSON.stringify([{id:args[3],phase:scenario==='failed-deploy'?'ERROR':'ACTIVE',spec:scenario==='custom-domain'?{...spec,domains:[{domain:'quills.example.com',type:'PRIMARY'}]}:spec,progress:{steps:[{name:'post_deploy',steps:[{name:'wait',component_name:'verify-dependencies',status:scenario==='failed-probe'?'ERROR':'SUCCESS'}]}]}}]);}
        throw new Error('Unexpected CLI command: '+key);
      };
      syncBuiltinESMExports();
      globalThis.fetch = async (url) => {
        if(new URL(url).origin!==(scenario==='custom-domain'?'https://quills.example.com':'https://app.example')) throw new Error('Wrong verification origin');
        const route = new URL(url).pathname;
        if (route === '/api/health') return Response.json({status:'ok'});
        if (route === '/api/auth/get-session') return Response.json(null);
        if (route === '/') return new Response('<script type="module" src="/assets/app.js"></script>',{headers:{'content-type':'text/html'}});
        return new Response(process.env.SCENARIO==='bad-web'?'KANEO_API_URL':'configured-api',{headers:{'content-type':'text/javascript'}});
      };
    `,
    );
    const env = {
      ...process.env,
      AZURE_SUBSCRIPTION_ID: "88557392-91d3-491f-ab97-234782d07f12",
      KANEO_IMAGE: `ghcr.io/playbookmediallc/kaneo@sha256:${"a".repeat(64)}`,
      AZURE_POSTGRES_PASSWORD: "private-postgres-password".repeat(2),
      AUTH_SECRET: "private-auth-secret".repeat(3),
      NOTIFICATION_SECRET_ENCRYPTION_KEY: "private-encryption-key".repeat(2),
      S3_ENDPOINT:
        "https://00000000000000000000000000000000.r2.cloudflarestorage.com",
      S3_BUCKET: "kaneo",
      S3_ACCESS_KEY_ID: "private-access-key",
      S3_SECRET_ACCESS_KEY: "private-s3-secret",
    };
    for (const scenario of [
      "success",
      "custom-domain",
      "pending-bootstrap",
      "missing-bootstrap-id",
      "existing-pending",
      "failed-deploy",
      "failed-probe",
      "wrong-active",
      "bad-web",
      "provider-error",
    ]) {
      const resultPath = path.join(directory, ".cache/deploy/result.json");
      mkdirSync(path.dirname(resultPath), { recursive: true });
      writeFileSync(resultPath, JSON.stringify({ deploymentId: "old-proof" }));
      const succeeds = [
        "success",
        "custom-domain",
        "pending-bootstrap",
        "missing-bootstrap-id",
      ].includes(scenario);
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          path.join(directory, "preload.mjs"),
          path.join(directory, "scripts/deploy/digitalocean.mjs"),
          "deploy",
        ],
        {
          encoding: "utf8",
          env: {
            ...env,
            SCENARIO: scenario,
            DO_APP_DOMAIN:
              scenario === "custom-domain" ? "quills.example.com" : "",
          },
          timeout: 10000,
        },
      );
      assert.equal(
        result.status,
        succeeds ? 0 : 1,
        `${scenario}: ${result.stdout} ${result.stderr}`,
      );
      assert.equal(existsSync(resultPath), succeeds, scenario);
      assert.doesNotMatch(
        result.stdout + result.stderr,
        /private-auth-secret|private-redis-key|private-postgres-password|SENSITIVE_PROVIDER_ERROR|private-s3-secret/,
      );
      if (succeeds) {
        const proof = JSON.parse(readFileSync(resultPath));
        assert.equal(proof.deploymentId, "release-1");
        assert.equal(proof.imageDigest, `sha256:${"a".repeat(64)}`);
        assert.ok(proof.checks.includes("object-storage"));
        assert.equal(
          proof.url,
          scenario === "custom-domain"
            ? "https://quills.example.com"
            : "https://app.example",
        );
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
