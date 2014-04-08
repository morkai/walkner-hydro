// Copyright (c) 2014, Łukasz Walukiewicz <lukasz@walukiewicz.eu>. Some Rights Reserved.
// Licensed under CC BY-NC-SA 4.0 <http://creativecommons.org/licenses/by-nc-sa/4.0/>.
// Part of the walkner-hydro project <http://lukasz.walukiewicz.eu/p/walkner-hydro>

'use strict';

var step = require('h5.step');
var esprima = require('esprima');
var estraverse = require('estraverse');
var escodegen = require('escodegen');

/**
 * @private
 * @const
 * @type {string}
 */
var TAG_VALUES_VARIABLE_NAME = '$__values__';

/**
 * @private
 * @const
 * @type {Array.<estraverse.Syntax>}
 */
var ILLEGAL_STATEMENT_TYPES = [
  estraverse.Syntax.WhileStatement,
  estraverse.Syntax.DoWhileStatement,
  estraverse.Syntax.ForStatement,
  estraverse.Syntax.ForInStatement,
  estraverse.Syntax.ThisExpression
];

/**
 * @private
 * @const
 * @type {Array.<string>}
 */
var ILLEGAL_FUNCTION_CALLS = [
  'eval',
  'require',
  'Function'
];

module.exports = parseCondition;

/**
 * @param {object.<string, *>} tagNamesMap
 * @param {string} code
 * @param {function(Error|null, string=, Array.<string>=)} done
 */
function parseCondition(tagNamesMap, code, done)
{
  step(
    function parseStep()
    {
      try
      {
        this.tree = esprima.parse('function test() {\n' + code + '\n}', {
          loc: true
        });
      }
      catch (err)
      {
        return this.done(done, err);
      }

      process.nextTick(this.next());
    },
    function collectLocalVariablesAndValidateStep()
    {
      try
      {
        this.localVariables = collectLocalVariablesAndValidate(this.tree);
      }
      catch (err)
      {
        return this.done(done, err);
      }

      process.nextTick(this.next());
    },
    function collectTagVariablesStep()
    {
      try
      {
        this.tags = collectTagVariables(
          tagNamesMap, this.tree, this.localVariables
        );
      }
      catch (err)
      {
        return this.done(done, err);
      }

      process.nextTick(this.next());
    },
    function changeLastExpressionToReturnStatementStep()
    {
      var testFuncBody = this.tree.body[0].body.body;
      var lastStatement = testFuncBody[testFuncBody.length - 1];

      if (lastStatement
        && lastStatement.type === esprima.Syntax.ExpressionStatement)
      {
        lastStatement.type = esprima.Syntax.ReturnStatement;
        lastStatement.argument = lastStatement.expression;

        delete lastStatement.expression;
      }
    },
    function regenerateCodeStep()
    {
      var code;

      try
      {
        code = escodegen.generate({
          type: esprima.Syntax.Program,
          body: this.tree.body[0].body.body
        });
      }
      catch (err)
      {
        return this.done(done, err);
      }

      done(null, code, this.tags);
    }
  );
}

/**
 * @private
 * @param {object} tree
 * @returns {Array.<string>}
 */
function collectLocalVariablesAndValidate(tree)
{
  var localVariables = [
    'Array',
    'Boolean',
    'Date',
    'Function',
    'Infinity',
    'Math',
    'NaN',
    'Number',
    'Object',
    'RegExp',
    'String',
    'undefined'
  ];

  estraverse.traverse(tree, {
    enter: function(node, parent)
    {
      var err;

      if (ILLEGAL_STATEMENT_TYPES.indexOf(node.type) !== -1)
      {
        err = new Error("Illegal statement: " + node.type + ".");
        err.code = 'ILLEGAL_STATEMENT';
        err.nodeLoc = node.loc;
        err.nodeType = node.type;

        throw err;
      }

      if (node.type === estraverse.Syntax.VariableDeclaration)
      {
        node.declarations.forEach(function(declarator)
        {
          if (declarator.id.name === TAG_VALUES_VARIABLE_NAME)
          {
            throw createReservedVariableNameError(node);
          }

          localVariables.push(declarator.id.name);
        });
      }
      else if (node.type === estraverse.Syntax.FunctionDeclaration
        || node.type === estraverse.Syntax.FunctionExpression)
      {
        node.params.forEach(function(identifier)
        {
          if (identifier.name === TAG_VALUES_VARIABLE_NAME)
          {
            throw createReservedVariableNameError(node);
          }

          localVariables.push(identifier.name);
        });
      }
      else if (node.type === estraverse.Syntax.Identifier
        && parent.type === estraverse.Syntax.CallExpression
        && ILLEGAL_FUNCTION_CALLS.indexOf(node.name) !== -1)
      {
        err = new Error("Illegal function call: " + node.name + ".");
        err.code = 'ILLEGAL_FUNCTION_CALL';
        err.nodeLoc = node.loc;
        err.nodeType = node.type;

        throw err;
      }
    }
  });

  return localVariables;
}

/**
 * @private
 * @param {object.<string, *>} tagNamesMap
 * @param {object} tree
 * @param {Array.<string>} localVariables
 * @returns {Array.<string>}
 */
function collectTagVariables(tagNamesMap, tree, localVariables)
{
  var tags = {};

  estraverse.traverse(tree, {
    enter: function(node, parent)
    {
      if (node.skipped === true
        || parent === null
        || parent.type === estraverse.Syntax.FunctionDeclaration
        || parent.type === estraverse.Syntax.Property)
      {
        return;
      }

      if (node.type === estraverse.Syntax.CallExpression)
      {
        return markAsSkipped(node.callee);
      }

      if (node.type === estraverse.Syntax.MemberExpression)
      {
        return handleMemberExpressionNode(
          localVariables, tagNamesMap, tags, node
        );
      }

      if (node.type === estraverse.Syntax.Identifier)
      {
        return handleIdentifierNode(localVariables, tagNamesMap, tags, node);
      }
    }
  });

  return Object.keys(tags);
}

/**
 * @private
 * @param {object} tree
 */
function markAsSkipped(tree)
{
  estraverse.traverse(tree, {
    enter: function(node)
    {
      node.skipped = true;
    }
  });
}

/**
 * @private
 * @param {Array.<string>} localVariables
 * @param {object.<string, *>} tagNamesMap
 * @param {object.<string, boolean>} tags
 * @param {object} node
 * @returns {estraverse.VisitorOption|undefined}
 * @throws {Error}
 */
function handleMemberExpressionNode(localVariables, tagNamesMap, tags, node)
{
  if (localVariables.indexOf(getLeftmostIdentifierName(node)) !== -1)
  {
    return markAsSkipped(node);
  }

  var tagName = getTagNameFromMemberExpression(node);

  if (tagName !== null)
  {
    var brackets = tagName.match(/\[(.*?)\]/g);
    var wildcardTagName = brackets === null
      ? tagName
      : tagName.replace(/\[(.*?)\]/g, '.*');

    assertTagNameExistence(
      tagNamesMap, node, wildcardTagName, brackets !== null
    );

    tags[wildcardTagName] = true;

    transformToTagValue(node, tagName, brackets);
  }

  return estraverse.VisitorOption.Skip;
}

/**
 * @private
 * @param {object.<string, *>} tagNamesMap
 * @param {object} node
 * @param {string} tagName
 * @param {boolean} wildcards
 * @throws {Error}
 */
function assertTagNameExistence(tagNamesMap, node, tagName, wildcards)
{
  var exists;

  if (wildcards)
  {
    var tagNameRegExp = new RegExp(
      '^' + escapeRegExp(tagName).replace(/\\\.\\\*/g, '\\.[a-zA-Z0-9]+') + '$'
    );

    exists = Object.keys(tagNamesMap).some(function(tagName)
    {
      return tagNameRegExp.test(tagName);
    });
  }
  else
  {
    exists = typeof tagNamesMap[tagName] !== 'undefined';
  }

  if (!exists)
  {
    throw createUnknownTagNameError(tagName, node);
  }
}

/**
 * @private
 * @param {Array.<string>} localVariables
 * @param {object.<string, *>} tagNamesMap
 * @param {object.<string, boolean>} tags
 * @param {object} node
 * @returns {estraverse.VisitorOption|undefined}
 */
function handleIdentifierNode(localVariables, tagNamesMap, tags, node)
{
  if (localVariables.indexOf(node.name) !== -1)
  {
    return;
  }

  if (typeof tagNamesMap[node.name] === 'undefined')
  {
    throw createUnknownTagNameError(node.name, node);
  }

  tags[node.name] = true;

  transformToTagValue(node, node.name, null);

  return estraverse.VisitorOption.Skip;
}

/**
 * @private
 * @param {object} memberExpression
 * @returns {string|null}
 */
function getLeftmostIdentifierName(memberExpression)
{
  if (memberExpression.object.type === estraverse.Syntax.MemberExpression)
  {
    return getLeftmostIdentifierName(memberExpression.object);
  }

  if (memberExpression.object.type === estraverse.Syntax.Identifier)
  {
    return memberExpression.object.name;
  }

  return null;
}

/**
 * @private
 * @param {object} node
 * @returns {string}
 * @throws {Error}
 */
function getTagNameFromMemberExpression(node)
{
  if (isInvalidObjectType(node))
  {
    throw createIllegalComplexTagNameError(node.object);
  }
  else if (isInvalidPropertyType(node))
  {
    throw createIllegalComplexTagNameError(node.property);
  }

  var prefix = node.object.type === estraverse.Syntax.Identifier
    ? node.object.name
    : getTagNameFromMemberExpression(node.object);

  var suffix;

  if (node.property.type === estraverse.Syntax.Identifier)
  {
    suffix = node.computed
      ? ('[' + node.property.name + ']')
      : ('.' + node.property.name);
  }
  else
  {
    suffix = '.' + node.property.value;
  }

  return prefix + suffix;
}

/**
 * @private
 * @param {object} node
 * @param {string} tagName
 * @param {Array.<string>|null} brackets
 */
function transformToTagValue(node, tagName, brackets)
{
  node.type = estraverse.Syntax.MemberExpression;
  node.computed = true;
  node.object = {
    type: estraverse.Syntax.Identifier,
    name: TAG_VALUES_VARIABLE_NAME
  };

  var propertyCode = "'" + tagName + "'";

  if (Array.isArray(brackets))
  {
    brackets.forEach(function(bracket)
    {
      var varName = bracket.substr(1, bracket.length - 2);

      propertyCode = propertyCode.replace(bracket, ".' + " + varName + " + '");
    });
  }

  node.property = esprima.parse(propertyCode).body[0].expression;
}

/**
 * @private
 * @param {object} node
 * @returns {boolean}
 */
function isInvalidPropertyType(node)
{
  return node.property.type !== estraverse.Syntax.Identifier
    && node.property.type !== estraverse.Syntax.Literal;
}

/**
 * @private
 * @param {object} node
 * @returns {boolean}
 */
function isInvalidObjectType(node)
{
  return node.object.type !== estraverse.Syntax.Identifier
    && node.object.type !== estraverse.Syntax.MemberExpression;
}

/**
 * @private
 * @param {string} tagName
 * @param {object} node
 * @returns {Error}
 */
function createUnknownTagNameError(tagName, node)
{
  var err = new Error("Unknown tag name: " + tagName);
  err.code = 'UNKNOWN_TAG_NAME';
  err.tagName = tagName;
  err.nodeLoc = node.loc;
  err.nodeType = node.type;

  throw err;
}

/**
 * @private
 * @param {object} node
 * @returns {Error}
 */
function createReservedVariableNameError(node)
{
  var err = new Error(
    TAG_VALUES_VARIABLE_NAME + " cannot be used as a local var."
  );
  err.code = 'RESERVED_VARIABLE_NAME';
  err.varName = TAG_VALUES_VARIABLE_NAME;
  err.nodeLoc = node.loc;

  return err;
}

/**
 * @private
 * @param {object} node
 * @returns {Error}
 */
function createIllegalComplexTagNameError(node)
{
  var err = new Error("Complex expressions in tag names are not allowed.");
  err.code = 'ILLEGAL_COMPLEX_TAG_NAME';
  err.nodeLoc = node.loc;
  err.nodeType = node.type;

  return err;
}

/**
 * @private
 * @param {string} string
 * @returns {string}
 */
function escapeRegExp(string)
{
  return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
}
