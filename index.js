const recast = require('recast')
const damerauLevenshtein = require('talisman/metrics/distance/damerau-levenshtein')

// destroy lines of code quickly
const removeLoC = (node) => {
  try {
    return node ? JSON.parse(JSON.stringify(node).replace(/,?"loc":\{"start":\{[^}]+\},"end":\{[^}]+\},"lines":\{[^}]+\},"indent":\d+\}/gi, '')) : {}
  } catch (exc) {
    return node
  }
}

const getParamsNames = (params) =>
  params.map(p => (
    p.type === 'Identifier'
      ? p.name
      : p.type === 'ObjectPattern'
      ? `{${p.properties.map(({ key }) => key.name).join(',')}}`
      : 'undefined'
    )
  )

// get functions from code, computing an id for each of them
const getFunctions = (node, prefix = 'root', results = []) => {
  console.log('hello!')
  if (Object.keys(node).length === 0) { return results }
  if (Array.isArray(node)) {
    return node.map((item, i) => ({ item, i }))
              .reduce((acc, {item, i}) => getFunctions(item, `${prefix} > [${i}]`, acc), results)
  }
  // detect pattern such as: `const add = ({ foo, bar }) => { ... }`
  let name = ''
  let params = []
  if (node.type === 'VariableDeclaration') {
    const firstDeclaration = node.declarations[0]
    if (firstDeclaration.type === 'VariableDeclarator' &&
    firstDeclaration.init.type === 'ArrowFunctionExpression') {
      name = firstDeclaration.id.name
      params = getParamsNames(firstDeclaration.init.params)
    }
  } else if (node.type === 'FunctionDeclaration') {
    name = node.id.name
    params = getParamsNames(node.params) 
  }
  const id = `${prefix} > ${name}(${params.join(',')})`
  return results.concat({ id, prefix, name, params, node })
}

// merge parameters of a function
// TODO: 
// handle parameter rename
// handle JS doc ?
// TODO handle conversion from `(foo, bar) =>` to `({ foo, bar }) =>` if at least some keys are the same
// TODO handle rename from `function add(foo, cat, duck) {` to `const add = (foo, cat, duck) => {`
const mergeParameters = (before, after, result) => {
  // console.log('after: ' + JSON.stringify(after, null, 2))
  result.params = []
 //  console.log(JSON.stringify(before.params, null, 2))
  const [a, b] = after.params.length >= before.params.length ? [after, before] : [before, after]

  // TODO handle conversion from (foo, bar) => to ({ foo, bar }) => if at least some keys are the same


  for (let i = 0; i < a.params.length; i++) {
    if (!result.params.map(x => JSON.stringify(x)).some((x) => x === JSON.stringify(a.params[i]))) {
      result.params.push(a.params[i])
    }
    if (i >= b.params.length) { continue }
    if(!result.params.map(x => JSON.stringify(x)).some((x) => x === JSON.stringify(b.params[i]))) {
      result.params.push(b.params[i])
    }
  }

}


const merge = (before, after) => {
  before = removeLoC(before)
  after = removeLoC(after)
  result = JSON.parse(JSON.stringify(after))

  const functions = getFunctions(before)
  console.log('functions: ' + JSON.stringify(functions, null, 2))

  mergeParameters(before, after, result)
  
  return result
}

const codeAfter = recast.parse`
  function add(foo, cat, duck) {
    return foo + duck +
    // Weird formatting, huh?
    cat;
  }
`

console.log(recast.print(
  merge(

    recast.parse`
    function add(foo, dog) {
      return foo +
      // Weird formatting, huh?
      dog;
    }
  `.program.body[0],

    recast.parse`
    function add(foo, cat, duck) {
      return foo + duck +
      // Weird formatting, huh?
      cat;
    }
  `.program.body[0]
  )
).code)
