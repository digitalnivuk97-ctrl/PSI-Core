const counters = {
  requests: 0,
  mutations: 0,
  mutationFailures: 0,
  authorizationFailures: 0,
  storageErrors: 0,
  rateLimitRejections: 0,
};

export type CounterName = keyof typeof counters;

export function incrementCounter(name: CounterName, amount = 1) {
  counters[name] += amount;
}

export function renderPrometheus() {
  return Object.entries(counters).map(([name, value]) => `psi_core_${name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)} ${value}`).join('\n') + '\n';
}
