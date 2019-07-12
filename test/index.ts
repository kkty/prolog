import chai from 'chai';
import 'mocha';
import { Functor, Constant, Variable, Application, Constraint, Substitution, Predicate, Fact, Rule, Space, Goal } from '../src';

describe('terms can be stringified correctly', () => {
  it('case 1', () => {
    const f = new Functor('f');
    const g = new Functor('g');
    const c = new Constant('c');
    const X = new Variable('X');
    const Y = new Variable('Y');

    const term = new Application(f, [
      new Application(g, [X, Y]),
      new Application(f, [X]),
      c,
    ]);

    chai.assert.strictEqual(term.toString(), 'f(g(X, Y), f(X), c)');
  });
});

describe('substitutions can be applied correctly', () => {
  it('case 1', () => {
    const X = new Variable('X');
    const Y = new Variable('Y');
    const f = new Functor('f');
    const c = new Constant('c');
    const d = new Constant('d');

    const term = new Application(f, [X, new Application(f, [X, Y])]);

    const substituted = Substitution.applyAll(term, [
      new Substitution(X, c),
      new Substitution(Y, d),
    ]);

    chai.assert.strictEqual(substituted.toString(), 'f(c, f(c, d))');
  });
});

describe('can process queries correctly', () => {
  describe('case 1', () => {
    const z = new Constant('z');
    const add = new Predicate('add');
    const s = new Functor('s');

    // add(z, Y, Y).
    const facts = [
      (() => {
        const Y = new Variable('Y');
        return new Fact(add, [z, Y, Y]);
      })(),
    ];

    // add(s(X), Y, s(Z)) :- add(X, Y, Z).
    const rules = [
      (() => {
        const X = new Variable('X');
        const Y = new Variable('Y');
        const Z = new Variable('Z');

        return new Rule(
          {
            predicate: add,
            terms: [new Application(s, [X]), Y, new Application(s, [Z])],
          },
          [
            { predicate: add, terms: [X, Y, Z] },
          ],
        );
      })(),
    ];

    const space = new Space(facts, rules);

    const X = new Variable('X');

    it('case 1-1', () => {
      // add(s(z), s(s(z)), X)
      const result = space.query([
        new Goal(add, [
          new Application(s, [z]),
          new Application(s, [new Application(s, [z])]),
          X,
        ]),
      ]);

      // there should be one suitable substituion
      const { done, value: substitutions } = result.next();
      chai.assert.strictEqual(done, false);
      chai.assert.strictEqual(Substitution.applyAll(X, substitutions).toString(), 's(s(s(z)))');
      chai.assert.strictEqual(result.next().done, true);
    });

    it('case 1-2', () => {
      // add(X, s(z), s(s(z)))
      const result = space.query([
        new Goal(add, [
          X,
          new Application(s, [z]),
          new Application(s, [new Application(s, [z])]),
        ]),
      ]);

      // there should be one suitable substituion
      const { done, value: substitutions } = result.next();
      chai.assert.strictEqual(done, false);
      chai.assert.strictEqual(Substitution.applyAll(X, substitutions).toString(), 's(z)');
      chai.assert.strictEqual(result.next().done, true);
    });
  });
});
