#!/usr/bin/env bun
console.log(`Available e2e tasks:
  mise run e2e:smart
  mise run e2e:cold-start
  mise run e2e:agent -- --agent pi

Agent e2e is opt-in and may call real model providers.
`);
