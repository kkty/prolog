import readline from 'readline';

import { Term, Goal, Rule, Predicate, Variable, Constant, Application, Functor, Fact, Space, Substitution } from './main';
import fs from 'fs';

class Cli {
  private constants: Constant[] = [];
  private functors: Functor[] = [];
  private predicates: Predicate[] = [];
  private rules: Rule[] = [];
  private facts: Fact[] = [];
  private result: null | Iterator<Map<Variable, Term>> = null;
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.rl.on('line', line => this.handleUserInput(line));

    this.prompt();
  }

  prompt() {
    this.rl.prompt();
  }

  handleUserInput(line: string) {
    if (this.result) {
      // stop searching
      if (line.endsWith(';')) {
        this.result = null;
        this.prompt();
        return;
      }

      const item = this.result.next();

      // the entire search has finished
      if (item.done) {
        this.result = null;
        this.prompt();
        return;
      }

      console.log(Array.from(item.value).map(i => `${i[0].toString()} -> ${i[1].toString()}`).join(', '));

      return;
    }

    try {
      const formatted = (() => {
        let s = line;
        s = s.trim();
        if (!s.endsWith('.')) {
          throw new Error('statements should end with `.`');
        }
        return s.slice(0, s.length - 1);
      })();

      let match;

      if (match = formatted.match(/\[\'(.+)\'\]/)) {
        this.loadFile(match[1]);
      } else {
        const goals = this.parseGoals(formatted);
        this.result = new Space(this.facts, this.rules).query(goals);
        const item = this.result.next();

        // search finished without any substitutions
        if (item.done) {
          this.result = null;
          return;
        }

        console.log(Array.from(item.value).map(i => `${i[0].toString()} -> ${i[1].toString()}`).join(', '));
      }
    } catch (e) {
      console.error(e);
    }

    if (!this.result) {
      this.prompt();
    }
  }

  // load rules and facts from file
  loadFile(filePath: string) {
    fs.readFileSync(filePath)
      .toString()
      .split('.')
      .map(i => i.trim())
      .forEach((s) => {
        if (s.length === 0) return;
        if (s.includes(':-')) {
          const rule = this.parseRule(s);
          this.rules.push(rule);
        } else {
          const fact = this.parseFact(s);
          this.facts.push(fact);
        }
      });
  }

  getOrCreateConstant(name: string): Constant {
    const found = this.constants.find(i => i.name === name);
    if (found) return found;
    const constant = new Constant(name);
    this.constants.push(constant);
    return constant;
  }

  getOrCreateFunctor(name: string): Functor {
    const found = this.functors.find(i => i.name === name);
    if (found) return found;
    const functor = new Functor(name);
    this.functors.push(functor);
    return functor;
  }

  getOrCreatePredicate(name: string): Predicate {
    const found = this.predicates.find(i => i.name === name);
    if (found) return found;
    const predicate = new Predicate(name);
    this.predicates.push(predicate);
    return predicate;
  }

  // convert tree into term
  constructTerm(node: Node): Term {
    if (node.children.length === 0) {
      if (startsWithUpperCase(node.value)) {
        return new Variable(node.value);
      }
      return this.getOrCreateConstant(node.value);

    }

    return new Application(
      this.getOrCreateFunctor(node.value),
      node.children.map(i => this.constructTerm(i)),
    );
  }

  parseRule(s: string): Rule {
    const [left, right] = s.split(':-');

    return new Rule(
      (() => {
        const tree = constructTree(left);
        const predicate = this.getOrCreatePredicate(tree.value);
        const terms = tree.children.map(i => this.constructTerm(i));
        return { predicate, terms };
      })(),
      split(right).map(constructTree).map((tree) => {
        const predicate = this.getOrCreatePredicate(tree.value);
        const terms = tree.children.map(i => this.constructTerm(i));
        return { predicate, terms };
      }),
    );
  }

  parseFact(s: string): Fact {
    const tree = constructTree(s);
    const predicate = this.getOrCreatePredicate(tree.value);
    const terms = tree.children.map(i => this.constructTerm(i));
    return new Fact(predicate, terms);
  }

  parseGoals(s: string): Goal[] {
    return split(s).map(constructTree).map((tree) => {
      const predicate = this.getOrCreatePredicate(tree.value);
      const terms = tree.children.map(i => this.constructTerm(i));
      return new Goal(predicate, terms);
    });
  }
}

// simple syntax tree
class Node {
  constructor(
    public readonly value: string,
    public readonly children: Node[],
  ) {}

  toString(): string {
    if (this.children.length === 0) return this.value;
    return `${this.value}(${this.children.map(i => i.toString()).join(', ')})`;
  }
}

// split by commas not in parentheses
// example: 'f(x,y),g(x,f(x,y))' -> ['f(x,y)', 'g(x,f(x,y))']
function split(s: string): string[] {
  const splitted = [];

  let buf = '';
  let depth = 0;

  for (let i = 0; i < s.length; i += 1) {
    if (depth === 0 && s[i] === ',') {
      splitted.push(buf);
      buf = '';
      continue;
    }

    if (s[i] === '(') depth += 1;
    else if (s[i] === ')') depth -= 1;

    buf += s[i];
  }

  if (buf.length) {
    splitted.push(buf);
  }

  return splitted;
}

function constructTree(str: string): Node {
  // remove whitespaces
  const s = str.replace(/ /g, '');

  let match;

  if (match = s.match(/^[a-zA-Z]+$/)) {
    return new Node(match[0], []);
  }

  if (!(match = s.match(/^([a-zA-Z]+)\((.+)\)$/))) {
    throw new Error('parse error');
  }

  const children = [];
  for (const s of split(match[2])) {
    const child = constructTree(s);
    children.push(child);
  }

  return new Node(match[1], children);
}

function startsWithUpperCase(s: string): boolean {
  return s[0].toUpperCase() === s[0];
}

new Cli();
