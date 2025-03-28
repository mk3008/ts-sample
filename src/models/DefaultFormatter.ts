import { SelectQuery } from "./SelectQuery";
import { SqlComponent, SqlComponentVisitor, SqlDialectConfiguration } from "./SqlComponent";
import { LiteralValue, RawString, IdentifierString, ColumnReference, FunctionCall, UnaryExpression, BinaryExpression, ParameterExpression, ArrayExpression, CaseExpression, CastExpression, ParenExpression, BetweenExpression, SwitchCaseArgument, ValueList, CaseKeyValuePair, StringSpecifierExpression, TypeValue } from "./ValueComponent";
import { ColumnAliasItem, ColumnAliasList, CommonTableItem, CommonTableList, CommonTableSource, Distinct, DistinctOn, FromClause, FunctionSource, GroupByClause, HavingClause, JoinItem, JoinList, NullsSortDirection, OrderByClause, OrderByItem, OverClause, PartitionByClause, PartitionByItem, PartitionByList, SelectClause, SelectItem, SortDirection, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WithClause } from "./Clause";

export class DefaultFormatter implements SqlComponentVisitor<string> {
    private handlers = new Map<symbol, (arg: SqlComponent) => string>();

    config: SqlDialectConfiguration;

    constructor(config: SqlDialectConfiguration | null = null) {
        this.config = config !== null ? config : new SqlDialectConfiguration();

        // value
        this.handlers.set(LiteralValue.kind, (expr) => this.decodeLiteralExpression(expr as LiteralValue));
        this.handlers.set(RawString.kind, (expr) => this.decodeRawString(expr as RawString));
        this.handlers.set(StringSpecifierExpression.kind, (expr) => this.decodeStringSpecifierExpression(expr as StringSpecifierExpression));
        this.handlers.set(IdentifierString.kind, (expr) => this.decodeIdentifierString(expr as IdentifierString));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.decodeSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(ValueList.kind, (expr) => this.decodeValueList(expr as ValueList));
        this.handlers.set(ColumnReference.kind, (expr) => this.decodeColumnReference(expr as ColumnReference));
        this.handlers.set(FunctionCall.kind, (expr) => this.decodeFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, (expr) => this.decodeUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.decodeBinaryExpression(expr as BinaryExpression));
        this.handlers.set(ParameterExpression.kind, (expr) => this.decodeParameterExpression(expr as ParameterExpression));
        this.handlers.set(SelectItem.kind, (expr) => this.decodeSelectExpression(expr as SelectItem));
        this.handlers.set(ArrayExpression.kind, (expr) => this.decodeArrayExpression(expr as ArrayExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.decodeCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.decodeCastExpression(expr as CastExpression));
        this.handlers.set(ParenExpression.kind, (expr) => this.decodeBracketExpression(expr as ParenExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.decodeBetweenExpression(expr as BetweenExpression));
        this.handlers.set(TypeValue.kind, (expr) => this.decodeTypeValue(expr as TypeValue));

        // column alias
        this.handlers.set(ColumnAliasList.kind, (expr) => this.decodeColumnAliasList(expr as ColumnAliasList));
        this.handlers.set(ColumnAliasItem.kind, (expr) => this.decodeColumnAliasItem(expr as ColumnAliasItem));

        // from
        this.handlers.set(FromClause.kind, (expr) => this.decodeFromClause(expr as FromClause));
        this.handlers.set(JoinItem.kind, (expr) => this.decodeJoinClause(expr as JoinItem));
        this.handlers.set(JoinList.kind, (expr) => this.decodeJoinCollection(expr as JoinList));
        this.handlers.set(SourceExpression.kind, (expr) => this.decodeSourceExpression(expr as SourceExpression));
        this.handlers.set(SubQuerySource.kind, (expr) => this.decodeSubQuerySource(expr as SubQuerySource));
        this.handlers.set(FunctionSource.kind, (expr) => this.decodeFunctionSource(expr as FunctionSource));
        this.handlers.set(TableSource.kind, (expr) => this.decodeTableSource(expr as TableSource));
        this.handlers.set(CommonTableSource.kind, (expr) => this.decodeCommonTableSource(expr as CommonTableSource));

        // order by
        this.handlers.set(OrderByClause.kind, (expr) => this.decodeOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.decodeOrderByItem(expr as OrderByItem));

        // partition by
        this.handlers.set(PartitionByClause.kind, (expr) => this.decodePartitionByClause(expr as PartitionByClause));
        this.handlers.set(PartitionByList.kind, (expr) => this.decodePartitionByList(expr as PartitionByList));
        this.handlers.set(PartitionByItem.kind, (expr) => this.decodePartitionByItem(expr as PartitionByItem));

        // window frame
        this.handlers.set(OverClause.kind, (expr) => this.decodeOverClause(expr as OverClause));
        this.handlers.set(WindowFrameClause.kind, (expr) => this.decodeWindowFrameClause(expr as WindowFrameClause));

        // where
        this.handlers.set(WhereClause.kind, (expr) => this.decodeWhereClause(expr as WhereClause));

        // group by
        this.handlers.set(GroupByClause.kind, (expr) => this.decodeGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.decodeHavingClause(expr as HavingClause));

        // with
        this.handlers.set(CommonTableItem.kind, (expr) => this.decodeCommonTableItem(expr as CommonTableItem));
        this.handlers.set(CommonTableList.kind, (expr) => this.decodeCCommonTableList(expr as CommonTableList));
        this.handlers.set(WithClause.kind, (expr) => this.decodeWithClause(expr as WithClause));

        // select
        this.handlers.set(SelectItem.kind, (expr) => this.decodeSelectExpression(expr as SelectItem));
        this.handlers.set(SelectClause.kind, (expr) => this.decodeSelectClause(expr as SelectClause));
        this.handlers.set(Distinct.kind, (expr) => this.decodeDistinct(expr as Distinct));
        this.handlers.set(DistinctOn.kind, (expr) => this.decodeDistinctOn(expr as DistinctOn));

        // select query
        this.handlers.set(SelectQuery.kind, (expr) => this.decodeSelectQuery(expr as SelectQuery));
    }

    visit(arg: SqlComponent): string {
        const handler = this.handlers.get(arg.getKind());
        return handler ? handler(arg) : `Unknown Expression`;
    }

    decodeTypeValue(arg: TypeValue): string {
        if (arg.argument !== null) {
            return `${arg.type.accept(this)}(${arg.argument.accept(this)})`;
        }
        return `${arg.type.accept(this)}`;
    }

    decodeStringSpecifierExpression(arg: StringSpecifierExpression): string {
        return `${arg.specifier.accept(this)}${arg.value.accept(this)}`;
    }

    decodeWithClause(arg: WithClause): string {
        return `with ${arg.recursive ? 'recursive' : ''} ${arg.commonTable.accept(this)}`;
    }
    decodeCCommonTableList(arg: CommonTableList): string {
        return `${arg.items.map((e) => e.accept(this)).join(", ")}`;
    }
    decodeCommonTableItem(arg: CommonTableItem): string {
        const columnAlias = arg.columnAlias === null ? '' : `(${arg.columnAlias.accept(this)})`;
        const materil = arg.materialized === null
            ? ''
            : arg.materialized ? ' materialized' : ' not materialized';
        if (columnAlias && materil) {
            return `${arg.name.accept(this)} (${columnAlias})${materil} as(${arg.query.accept(this)})`;
        } else if (columnAlias) {
            return `${arg.name.accept(this)} (${columnAlias}) as(${arg.query.accept(this)})`;
        } else if (materil) {
            return `${arg.name.accept(this)}${materil} as(${arg.query.accept(this)})`;
        }
        return `${arg.name.accept(this)} as(${arg.query.accept(this)})`;
    }
    decodeColumnAliasItem(arg: ColumnAliasItem): string {
        return `${arg.name.accept(this)}`;
    }
    decodeColumnAliasList(arg: ColumnAliasList): string {
        return `${arg.items.map((e) => e.accept(this)).join(", ")}`;
    }
    decodeDistinctOn(arg: DistinctOn): string {
        return `distinct on(${arg.value.accept(this)})`;
    }
    decodeDistinct(arg: Distinct): string {
        return `distinct`;
    }

    decodeHavingClause(arg: HavingClause): string {
        return `having ${arg.condition.accept(this)}`;
    }
    decodeGroupByClause(arg: GroupByClause): string {
        const part = arg.grouping.map((e) => e.accept(this)).join(", ");
        return `group by ${part}`;
    }

    decodeCommonTableSource(arg: CommonTableSource): string {
        return `${arg.name.accept(this)}`;
    }

    decodePartitionByItem(arg: PartitionByItem): string {
        return `${arg.value.accept(this)}`;
    }
    decodePartitionByList(arg: PartitionByList): string {
        return `${arg.items.map((e) => e.accept(this)).join(", ")}`;
    }

    decodeFromClause(arg: FromClause): string {
        if (arg.join !== null) {
            return `from ${arg.source.accept(this)} ${arg.join.accept(this)}`;
        }
        return `from ${arg.source.accept(this)}`;
    }

    decodeJoinClause(arg: JoinItem): string {
        const joinType = `${arg.joinType.accept(this)}`;
        const lateral = arg.lateral ? " lateral" : "";
        const condition = arg.condition !== null ? ` on ${arg.condition.accept(this)} ` : "";
        return `${joinType}${lateral} ${arg.source.accept(this)}${condition}`;
    }

    decodeJoinCollection(arg: JoinList): string {
        return `${arg.items.map((e) => e.accept(this)).join(" ")}`;
    }

    decodeSourceExpression(arg: SourceExpression): string {
        const columnAlias = arg.columnAlias !== null ? `(${arg.columnAlias.accept(this)})` : "";
        let tableAlias = arg.alias !== null ? `(${arg.alias.accept(this)})` : "";

        // Avoid duplicate alias if the name is the same as the alias
        if (arg.datasource.name !== null && arg.datasource.name.accept(this) === tableAlias) {
            tableAlias = "";
        }

        if (columnAlias && tableAlias) {
            return `${arg.datasource.accept(this)}${columnAlias} as ${tableAlias}`;
        }
        if (columnAlias) {
            return `${arg.datasource.accept(this)}${columnAlias}`;
        }
        if (tableAlias) {
            return `${arg.datasource.accept(this)} as ${tableAlias}`;
        }
        return `${arg.datasource.accept(this)}`;
    }

    decodeSubQuerySource(arg: SubQuerySource): string {
        return `(${arg.query.accept(this)})`;
    }

    decodeFunctionSource(arg: FunctionSource): string {
        if (arg.argument !== null) {
            return `${arg.name.accept(this)} (${arg.argument.accept(this)})`;
        }
        return `${arg.name.accept(this)} ()`;
    }
    decodeTableSource(arg: TableSource): string {
        if (arg.namespaces !== null) {
            return `${arg.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${arg.table.accept(this)}`;
        }
        return `${arg.table.accept(this)}`;
    }

    decodeValueList(arg: ValueList): string {
        return `${arg.values.map((v) => v.accept(this)).join(", ")}`;
    }

    decodeSwitchCaseArgument(arg: SwitchCaseArgument): string {
        const casePart = arg.casePairs.map((kv: CaseKeyValuePair) => `when ${kv.key.accept(this)} then ${kv.value.accept(this)}`).join(" ");
        const elsePart = arg.elseValue ? ` else ${arg.elseValue.accept(this)}` : "";
        return `${casePart}${elsePart}`;
    }

    decodeColumnReference(arg: ColumnReference): string {
        if (arg.namespaces != null) {
            return `${arg.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${arg.column.accept(this)}`;
        }
        return `${arg.column.accept(this)}`;
    }

    decodeFunctionCall(arg: FunctionCall): string {
        if (arg.argument !== null) {
            return `${arg.name.accept(this)}(${arg.argument.accept(this)})`;
        }
        return `${arg.name.accept(this)}()`;
    }

    decodeUnaryExpression(arg: UnaryExpression): string {
        return `${arg.operator.accept(this)} ${arg.expression.accept(this)}`;
    }

    decodeBinaryExpression(arg: BinaryExpression): string {
        return `${arg.left.accept(this)} ${arg.operator.accept(this)} ${arg.right.accept(this)}`;
    }

    decodeLiteralExpression(arg: LiteralValue): string {
        if (typeof arg.value === "string") {
            return `'${arg.value.replace(/'/g, "''")}'`;
        } else if (arg.value === null) {
            return "null";
        }
        return arg.value.toString();
    }

    decodeParameterExpression(arg: ParameterExpression): string {
        return `${this.config.parameterSymbol}${arg.name.accept(this)}`;
    }

    decodeSelectExpression(arg: SelectItem): string {
        if (arg.alias !== null) {
            if (arg.value instanceof ColumnReference) {
                const c = arg.value as ColumnReference;
                if (c.column.name === arg.alias.name) {
                    return `${arg.value.accept(this)}`;
                } else {
                    return `${arg.value.accept(this)} as ${arg.alias.accept(this)}`;
                }
            }
            return `${arg.value.accept(this)} as ${arg.alias.accept(this)}`;
        }
        return arg.value.accept(this);
    }

    decodeSelectClause(arg: SelectClause): string {
        const distinct = arg.distinct !== null ? " " + arg.distinct.accept(this) : "";
        const colum = arg.items.map((e) => e.accept(this)).join(", ");
        return `select${distinct} ${colum}`;
    }

    decodeSelectQuery(arg: SelectQuery): string {
        return arg.selectClause.accept(this);
    }

    decodeArrayExpression(arg: ArrayExpression): string {
        return `array[${arg.expression.accept(this)}]`;
    }

    decodeCaseExpression(arg: CaseExpression): string {
        if (arg.condition !== null) {
            return `case ${arg.condition.accept(this)} ${arg.switchCase.accept(this)} end`;
        }
        return `case ${arg.switchCase.accept(this)} end`;
    }

    decodeCastExpression(arg: CastExpression): string {
        return `${arg.input.accept(this)}::${arg.castType.accept(this)}`;
    }

    decodeBracketExpression(arg: ParenExpression): string {
        return `(${arg.expression.accept(this)})`;
    }

    decodeBetweenExpression(arg: BetweenExpression): string {
        if (arg.negated) {
            return `${arg.expression.accept(this)} not between ${arg.lower.accept(this)} and ${arg.upper.accept(this)}`;
        }
        return `${arg.expression.accept(this)} between ${arg.lower.accept(this)} and ${arg.upper.accept(this)}`;
    }

    decodePartitionByClause(arg: PartitionByClause): string {
        return `partition by ${arg.partitionBy.accept(this)}`;
    }

    decodeOrderByClause(arg: OrderByClause): string {
        const part = arg.orderBy.map((e) => e.accept(this)).join(", ");
        return `order by ${part}`;
    }

    decodeOrderByItem(arg: OrderByItem): string {
        const direction = arg.sortDirection === SortDirection.Ascending ? null : "desc";
        const nullsOption = arg.nullsPosition !== null ? (arg.nullsPosition === NullsSortDirection.First ? "nulls first" : "nulls last") : null;

        if (direction !== null && nullsOption !== null) {
            return `${arg.value.accept(this)} ${direction} ${nullsOption}`;
        } else if (direction !== null) {
            return `${arg.value.accept(this)} ${direction}`;
        } else if (nullsOption !== null) {
            return `${arg.value.accept(this)} ${nullsOption}`;
        }
        return arg.value.accept(this);
    }

    decodeOverClause(arg: OverClause): string {
        if (arg.windowFrameAlias !== null) {
            return `over ${arg.windowFrameAlias}`;
        } else if (arg.partitionByClause !== null && arg.orderByClause) {
            return `over(${arg.partitionByClause.accept(this)} ${arg.orderByClause.accept(this)})`;
        } else if (arg.partitionByClause !== null) {
            return `over(${arg.partitionByClause.accept(this)})`;
        } else if (arg.orderByClause !== null) {
            return `over(${arg.orderByClause.accept(this)})`;
        }
        return "over ()";
    }

    decodeWindowFrameClause(arg: WindowFrameClause): string {
        if (arg.partitionBy !== null && arg.orderBy !== null) {
            return `window ${arg.alias.accept(this)} as(${arg.partitionBy.accept(this)} ${arg.orderBy.accept(this)})`;
        } else if (arg.partitionBy !== null) {
            return `window ${arg.alias.accept(this)} as(${arg.partitionBy.accept(this)})`;
        } else if (arg.orderBy !== null) {
            return `window ${arg.alias.accept(this)} as(${arg.orderBy.accept(this)})`;
        }
        throw new Error("Invalid WindowFrameClause");
    }

    decodeWhereClause(arg: WhereClause): string {
        return `where ${arg.condition.accept(this)}`;
    }

    decodeRawString(arg: RawString): string {
        const invalidChars = new Set(["'", '"', ",", ";", ":", ".", "--", "/*"]);
        if (invalidChars.has(arg.keyword)) {
            throw new Error(`invalid keyword: ${arg.keyword} `);
        } else if (arg.keyword.trim() === "") {
            throw new Error("invalid keyword: empty string");
        }
        return arg.keyword.trim();
    }

    decodeIdentifierString(arg: IdentifierString): string {
        // No need to escape wildcards
        if (arg.name === '*') {
            return arg.name;
        }
        return `${this.config.identifierEscape.start}${arg.name}${this.config.identifierEscape.end}`;
    }
}