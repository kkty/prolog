export type Term = Application | Constant | Variable;

// `{Functor,Constant,Variable,Application}name` is only for readability
// and they not affect behaviours

export class Functor {
  constructor(public readonly name: string) {}
  toString(): string { return this.name; }
}

export class Constant {
  constructor(public readonly name: string) {}
  toString(): string { return this.name; }
}

export class Variable {
  constructor(public readonly name: string) {}
  toString(): string { return this.name; }
}

export class Application {
  constructor(
    public readonly functor: Functor,
    public readonly terms: Term[],
  ) {}

  toString(): string {
    return `${this.functor.name}(${this.terms.map(term => term.toString()).join(', ')})`;
  }
}

export function listVariables(term: Term): Set<Variable> {
  const variables = new Set<Variable>();

  if (term instanceof Variable) {
    variables.add(term);
  }

  if (term instanceof Application) {
    term.terms.forEach((term) => {
      listVariables(term).forEach((variable) => {
        variables.add(variable);
      });
    });
  }

  return variables;
}

export class Predicate {
  constructor(public readonly name: string) {}
  toString(): string { return this.name; }
}

export class Fact {
  constructor(
    public readonly predicate: Predicate,
    public readonly terms: Term[],
  ) {}

  toString(): string {
    return `${this.predicate.toString()}(${this.terms.map(i => i.toString()).join(', ')})`;
  }

  // refresh the variables
  clone(): Fact {
    const variables = new Set<Variable>();

    this.terms.forEach((term) => {
      listVariables(term).forEach((variable) => {
        variables.add(variable);
      });
    });

    const substitutions = Array.from(variables).map((variable) => {
      return new Substitution(variable, new Variable(variable.name));
    });

    return new Fact(
      this.predicate,
      this.terms.map(term => Substitution.applyAll(term, substitutions)),
    );
  }
}

export class Rule {
  constructor(
    public readonly left: { predicate: Predicate, terms: Term[] },
    public readonly right: { predicate: Predicate, terms: Term[] }[],
  ) {}

  toString(): string {
    const left = `${this.left.predicate.toString()}(${this.left.terms.map(i => i.toString()).join(', ')})`;
    const right = this.right.map(({ predicate, terms }) => `${predicate.toString()}(${terms.map(i => i.toString()).join(', ')})`);
    return `${left} :- [${right.join(', ')}]`;
  }

  // refresh the variables
  clone(): Rule {
    const variables = new Set<Variable>();

    this.left.terms.forEach((term) => {
      listVariables(term).forEach((variable) => {
        variables.add(variable);
      });
    });

    this.right.forEach(({ terms }) => {
      terms.forEach((term) => {
        listVariables(term).forEach((variable) => {
          variables.add(variable);
        });
      });
    });

    const substitutions = Array.from(variables).map((variable) => {
      return new Substitution(variable, new Variable(variable.name));
    });

    const left = {
      predicate: this.left.predicate,
      terms: this.left.terms.map(term => Substitution.applyAll(term, substitutions)),
    };

    const right = this.right.map(({ predicate, terms }) => ({
      predicate,
      terms: terms.map(term => Substitution.applyAll(term, substitutions)),
    }));

    return new Rule(left, right);
  }
}

export class Goal {
  constructor(
    public readonly predicate: Predicate,
    public readonly terms: Term[],
  ) {}

  toString(): string {
    return `${this.predicate}(${this.terms.map(i => i.toString()).join(', ')})`;
  }
}

export class Substitution {
  constructor(
    public readonly variable: Variable,
    public readonly term: Term,
  ) {}

  apply(term: Term): Term {
    if (term instanceof Variable) {
      if (term === this.variable) return this.term;
      return term;
    }

    if (term instanceof Constant) return term;

    return new Application(
      term.functor,
      term.terms.map(term => this.apply(term)),
    );
  }

  toString(): string {
    return `${this.variable.toString()} -> ${this.term.toString()}`;
  }

  static applyAll(term: Term, substitutions: Substitution[]): Term {
    return substitutions.reduce((term, substitution) => substitution.apply(term), term);
  }
}

export class Constraint {
  constructor(
    public readonly left: Term,
    public readonly right: Term,
  ) {}

  toString(): string {
    return `${this.left.toString()} = ${this.right.toString()}`;
  }

  // return null on failure
  static unify(constraints: Constraint[]): Substitution[] | null {
    if (constraints.length === 0) return [];

    // take the first element
    const [{ left, right }] = constraints;

    if (left === right) {
      return Constraint.unify(constraints.slice(1));
    }

    if (left instanceof Variable || right instanceof Variable) {
      // this conversion is valid as `left instanceof Variable || right instanceof Variable` holds
      const substitution = (() => {
        if (left instanceof Variable) return new Substitution(left, right);
        if (right instanceof Variable) return new Substitution(right, left);
      })() as Substitution;

      const substitutions = Constraint.unify(
        constraints.slice(1)
          .map(constraint => new Constraint(substitution.apply(constraint.left), substitution.apply(constraint.right))),
      );

      if (!substitutions) return null;

      return [substitution, ...substitutions];
    }

    if (left instanceof Constant || right instanceof Constant) {
      if (left === right) return [];
      return null;
    }

    // from here, `left instanceof Application && right instanceof Application` holds

    if (left.functor !== right.functor) return null;
    if (left.terms.length !== right.terms.length) return null;

    const constraintsNew = [];
    for (let i = 0; i < left.terms.length; i += 1) {
      constraintsNew.push(new Constraint(left.terms[i], right.terms[i]));
    }

    return Constraint.unify([
      ...constraintsNew,
      ...constraints.slice(1),
    ]);
  }
}

// `space` is a set of facts and rules
export class Space {
  constructor(
    private readonly facts: Fact[],
    private readonly rules: Rule[],
  ) {}

  query(goals: Goal[]): Iterator<Map<Variable, Term>> {
    type Item = { goals: Goal[], substitutions: Substitution[] };
    const queue: Item[] = [{ goals, substitutions: [] }];

    const freeVariables = new Set<Variable>();
    for (const goal of goals) {
      for (const term of goal.terms) {
        listVariables(term).forEach((variable) => {
          freeVariables.add(variable);
        });
      }
    }

    return {
      next: () => {
        while (queue.length) {
          // this type conversion is valid as queue.length > 0
          const { goals, substitutions } = queue.shift() as Item;

          if (goals.length === 0) {
            const variableTermMapping = new Map<Variable, Term>();

            freeVariables.forEach((variable) => {
              variableTermMapping.set(variable, Substitution.applyAll(variable, substitutions));
            });

            // `variableTermMapping.get(...)` should not contain variables

            let isValid = true;

            variableTermMapping.forEach((term, _) => {
              if (listVariables(term).size > 0) {
                isValid = false;
              }
            });

            if (!isValid) {
              continue;
            }

            return {
              done: false,
              value: variableTermMapping,
            };
          }

          const goal = goals[0];

          for (const f of this.facts) {
            // refresh variables
            const fact = f.clone();

            if (goal.predicate !== fact.predicate) continue;
            if (goal.terms.length !== fact.terms.length) continue;

            const constraints = [];
            for (let i = 0; i < goal.terms.length; i += 1) {
              constraints.push(new Constraint(Substitution.applyAll(goal.terms[i], substitutions), fact.terms[i]));
            }

            const substitutionsNew = Constraint.unify(constraints);

            // if unification succeeded, push an item to the queue
            if (substitutionsNew) {
              queue.push({
                goals: goals.slice(1),
                substitutions: [...substitutions, ...substitutionsNew],
              });
            }
          }

          for (const r of this.rules) {
            // refresh variables
            const rule = r.clone();

            if (goal.predicate !== rule.left.predicate) continue;
            if (goal.terms.length !== rule.left.terms.length) continue;

            const constraints = [];
            for (let i = 0; i < goal.terms.length; i += 1) {
              constraints.push(new Constraint(Substitution.applyAll(goal.terms[i], substitutions), rule.left.terms[i]));
            }

            const substitutionsNew = Constraint.unify(constraints);

            // if unification succeeded, push an item to the queue
            if (substitutionsNew) {
              queue.push({
                // replace one goal with new goals
                goals: [...goals.slice(1), ...rule.right.map(i => new Goal(i.predicate, i.terms))],
                substitutions: [...substitutions, ...substitutionsNew],
              });
            }
          }
        }

        return {
          done: true,
          value: new Map(),
        };
      },
    };
  }
}
