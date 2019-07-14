An implementation of Prolog in TypeScript.

### Requirements

- Node.js (>=10)

### Usage

```console
$ npm install ts-prolog
$ ts-prolog
```

### Notes

- Only a subset of the language features are implemented.
- BFS is used for searching.

### Example

`rules.pl`

```prolog
mult(z, X, z).
add(z, Y, Y).
add(s(X), Y, s(Z)) :- add(X, Y, Z).
mult(s(X), Y, Z) :- mult(X, Y, P), add(P, Y, Z).
nat(z).
nat(s(X)) :- nat(X).
```

```console
$ ts-prolog
> ['rules.pl'].
fact added: mult(z, X, z)
fact added: add(z, Y, Y)
rule added: add(s(X), Y, s(Z)) :- [add(X, Y, Z)]
rule added: mult(s(X), Y, Z) :- [mult(X, Y, P), add(P, Y, Z)]
fact added: nat(z)
rule added: nat(s(X)) :- [nat(X)]

> add(s(z), s(s(z)), X).
[X -> s(s(s(z)))]  (ENTER)
search finished

> add(s(z), X, s(s(s(z)))).
[X -> s(s(z))] (ENTER)
search finished

> mult(s(s(z)), s(s(s(z))), X).
[X -> s(s(s(s(s(s(z))))))] (ENTER)
search finished

> nat(X).
[X -> z] (ENTER)
[X -> s(z)] (ENTER)
[X -> s(s(z))] (ENTER)
[X -> s(s(s(z)))] (ENTER)
[X -> s(s(s(s(z))))] (Ctrl-C)

> add(X, Y, s(s(z))).
[X -> z, Y -> s(s(z))] (ENTER)
[X -> s(z), Y -> s(z)] (ENTER)
[X -> s(s(z)), Y -> z] (ENTER)
search finished

> add(X, Y, s(s(z))), mult(X, Y, s(z)).
[X -> s(z), Y -> s(z)] (ENTER)
search finished
```
