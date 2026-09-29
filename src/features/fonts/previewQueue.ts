/** Runs font-preview loads a few at a time so opening the picker never floods the network. */
const MAX_CONCURRENT = 3;
let running = 0;
const waiting: (() => void)[] = [];

export function enqueuePreview<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      running++;
      task()
        .then(resolve, reject)
        .finally(() => {
          running--;
          waiting.shift()?.();
        });
    };
    if (running < MAX_CONCURRENT) run();
    else waiting.push(run);
  });
}
