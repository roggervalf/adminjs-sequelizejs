import escape from 'escape-regexp';
import { Op } from 'sequelize';

export const uuidRegex = /^[0-9A-F]{8}-[0-9A-F]{4}-[5|4|3|2|1][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;

const OPERATOR_SEPARATOR = '~';

const MATCHING_PATTERNS = {
  EQ: 'equals',
  NE: 'notEquals',
  CO: 'contains',
  EW: 'endsWith',
  SW: 'startsWith',
};

const OPERATORS = {
  AND: 'and',
  OR: 'or',
};

export const convertFilter = (filter) => {
  if (!filter) {
    return {};
  }
  return filter.reduce((memo, filterProperty) => {
    const { property, value, path: filterPath } = filterProperty;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_, index] = filterPath.split('.');
    const isArray = typeof index !== 'undefined' && !Number.isNaN(Number(index));
    const previousValue = memo[property.name()] || {};
    switch (property.type()) {
    case 'string': {
      if (property.sequelizePath.values || uuidRegex.test(value.toString())) {
        return {
          [property.name()]: { [Op.eq]: `${escape(value)}` },
          ...memo,
        };
      }
      if (isArray) {
        return {
          ...memo,
          [property.name()]: {
            [Op.in]: [...(previousValue[Op.in] || []), escape(value)],
          },
        };
      }

      let operatorExpression;
      if (typeof value === 'object') {
        if (value[MATCHING_PATTERNS.SW]) {
          operatorExpression = {
            [(Op.like as unknown) as string]: `${escape(value[MATCHING_PATTERNS.SW])}%`,
          };
        } else if (value[MATCHING_PATTERNS.EW]) {
          operatorExpression = {
            [(Op.like as unknown) as string]: `%${escape(value[MATCHING_PATTERNS.EW])}`,
          };
        } else if (value[MATCHING_PATTERNS.EQ]) {
          operatorExpression = {
            [Op.eq]: `${escape(value[MATCHING_PATTERNS.EQ])}`,
          };
        } else if (value[MATCHING_PATTERNS.NE]) {
          operatorExpression = {
            [Op.ne]: `${escape(value[MATCHING_PATTERNS.NE])}`,
          };
        } else {
          const orPrefix = `${OPERATORS.OR}${OPERATOR_SEPARATOR}`;
          if (value[`${orPrefix}${MATCHING_PATTERNS.SW}`]) {
            operatorExpression = {
              [(Op.like as unknown) as string]: `${escape(value[`${orPrefix}${MATCHING_PATTERNS.SW}`])}%`,
            };
          } else if (value[`${orPrefix}${MATCHING_PATTERNS.EW}`]) {
            operatorExpression = {
              [(Op.like as unknown) as string]: `%${escape(value[`${orPrefix}${MATCHING_PATTERNS.EW}`])}`,
            };
          } else if (value[`${orPrefix}${MATCHING_PATTERNS.EQ}`]) {
            operatorExpression = {
              [Op.eq]: `${escape(value[`${orPrefix}${MATCHING_PATTERNS.EQ}`])}`,
            };
          } else if (value[`${orPrefix}${MATCHING_PATTERNS.NE}`]) {
            operatorExpression = {
              [Op.ne]: `${escape(value[`${orPrefix}${MATCHING_PATTERNS.NE}`])}`,
            };
          } else if (value[OPERATORS.OR]) {
            operatorExpression = {
              [(Op.like as unknown) as string]: `%${escape(value[OPERATORS.OR])}%`,
            };
          }

          return {
            ...memo,
            [Op.or]: [
              ...(memo[Op.or] || []),
              {
                [property.name()]: operatorExpression,
              },
            ],
          };
        }
      } else {
        operatorExpression = {
          [(Op.like as unknown) as string]: `%${escape(value)}%`,
        };
      }

      return {
        ...memo,
        [Op.and]: [
          ...(memo[Op.and] || []),
          {
            [property.name()]: operatorExpression,
          },
        ],
      };
    }
    case 'boolean': {
      let bool;
      if (value === 'true') bool = true;
      if (value === 'false') bool = false;
      if (bool === undefined) return memo;

      if (isArray) {
        return {
          ...memo,
          [property.name()]: {
            [Op.in]: [
              ...(previousValue[Op.in] || []),
              bool,
            ],
          },
        };
      }
      return {
        ...memo,
        [property.name()]: bool,
      };
    }
    case 'number': {
      if (!Number.isNaN(Number(value))) {
        if (isArray) {
          return {
            ...memo,
            [property.name()]: {
              [Op.in]: [...(previousValue[Op.in] || []), Number(value)],
            },
          };
        }
        return {
          [property.name()]: Number(value),
          ...memo,
        };
      }
      return memo;
    }
    case 'date':
    case 'datetime': {
      if (value.from || value.to) {
        return {
          [property.name()]: {
            ...(value.from && { [Op.gte]: value.from }),
            ...(value.to && { [Op.lte]: value.to }),
          },
          ...memo,
        };
      }
      break;
    }
    default:
      break;
    }
    if (isArray) {
      return {
        ...memo,
        [property.name()]: {
          [Op.in]: [...(previousValue[Op.in] || []), value],
        },
      };
    }
    return {
      [property.name()]: value,
      ...memo,
    };
  }, {});
};

export default convertFilter;
