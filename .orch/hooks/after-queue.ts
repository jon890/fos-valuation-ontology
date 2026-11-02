// migrate-orch-dir --hooks 가 `queue.after_merged` 에서 만들었다.
// 머지 큐의 --after-merged 와 같이 PR 을 하나라도 머지한 큐가 끝난 뒤 한 번 bash -c 로 돈다.
// 옛 칸을 돌리던 것과 같은 argv, 환경 변수, 작업 디렉터리로 옛 명령을 부르고 그 종료 코드로 끝난다. stdin 의 입력도 그대로 넘긴다.
// 이 파일은 저장소의 것이라 고쳐 써도 된다. 설치 캐시의 경로가 바뀌므로 orch 스킬의 모듈을 import 하지 않는다.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { constants } from 'node:os'

const raw = readFileSync(0, 'utf8')
const input = JSON.parse(raw)
const pr = input.pr ?? {}

function runOld(argv: string[], opts: { env?: NodeJS.ProcessEnv; cwd?: string } = {}): number {
  const done = spawnSync(argv[0], argv.slice(1), { input: raw, stdio: ['pipe', 'inherit', 'inherit'], env: opts.env ?? process.env, cwd: opts.cwd })
  if (done.error && (done.error as NodeJS.ErrnoException).code !== 'EPIPE') {
    process.stderr.write(`${argv[0]} 를 실행하지 못했다: ${done.error.message}\n`)
    return (done.error as NodeJS.ErrnoException).code === 'ENOENT' ? 127 : 1
  }
  if (done.signal) return 128 + ((constants.signals as Record<string, number>)[done.signal] ?? 0)
  return done.status ?? 1
}

const COMMAND = "bash \"$(git rev-parse --show-toplevel)/scripts/deploy-prod.sh\""
// 옛 명령은 --repo 로 준 경로에서 돌았다. 이벤트 실행기가 그 경로를 ORCH_CHECKOUT 으로 준다
const checkout = process.env.ORCH_CHECKOUT || undefined
const join = (value: unknown): string => (Array.isArray(value) ? value.map(String).join(' ') : '')
const env = { ...process.env, MERGED_PRS: join(input.merged_prs), CODE_PRS: join(input.code_prs) }
process.exitCode = runOld(['bash', '-c', COMMAND], { env, cwd: checkout })
