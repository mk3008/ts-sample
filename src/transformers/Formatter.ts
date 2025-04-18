import { BinarySelectQuery, SimpleSelectQuery, ValuesQuery } from "../models/SelectQuery";
import { SqlComponent, SqlComponentVisitor } from "../models/SqlComponent";
import {
    LiteralValue,
    RawString,
    IdentifierString,
    ColumnReference,
    FunctionCall,
    UnaryExpression,
    BinaryExpression,
    ParameterExpression,
    ArrayExpression,
    CaseExpression,
    CastExpression,
    ParenExpression,
    BetweenExpression,
    SwitchCaseArgument,
    ValueList,
    CaseKeyValuePair,
    StringSpecifierExpression,
    TypeValue,
    WindowFrameExpression,
    WindowFrameSpec,
    WindowFrameBound,
    WindowFrameBoundaryValue,
    WindowFrameBoundStatic,
    InlineQuery,
    TupleExpression
} from "../models/ValueComponent";
import { CommonTable, Distinct, DistinctOn, FetchSpecification, FetchType, ForClause, FromClause, FunctionSource, GroupByClause, HavingClause, JoinClause, JoinOnClause, JoinUsingClause, LimitClause, NullsSortDirection, OrderByClause, OrderByItem, PartitionByClause, SelectClause, SelectItem, SortDirection, SourceAliasExpression, SourceExpression, SubQuerySource, TableSource, WhereClause, WindowFrameClause, WithClause } from "../models/Clause";

interface FormatterConfig {
    identifierEscape: {
        start: string;
        end: string;
    };
    parameterSymbol: string;
}

export class Formatter implements SqlComponentVisitor<string> {
    private handlers: Map<symbol, (arg: any) => string>;
    private config: FormatterConfig;

    constructor() {
        this.handlers = new Map<symbol, (arg: any) => string>();

        // Default settings
        this.config = {
            identifierEscape: {
                start: '"',
                end: '"'
            },
            parameterSymbol: ':' // Use PostgreSQL style as default
        };

        // value
        this.handlers.set(LiteralValue.kind, (expr) => this.visitLiteralExpression(expr as LiteralValue));
        this.handlers.set(RawString.kind, (expr) => this.visitRawString(expr as RawString));
        this.handlers.set(StringSpecifierExpression.kind, (expr) => this.visitStringSpecifierExpression(expr as StringSpecifierExpression));
        this.handlers.set(IdentifierString.kind, (expr) => this.visitIdentifierString(expr as IdentifierString));
        this.handlers.set(SwitchCaseArgument.kind, (expr) => this.visitSwitchCaseArgument(expr as SwitchCaseArgument));
        this.handlers.set(ValueList.kind, (expr) => this.visitValueList(expr as ValueList));
        this.handlers.set(ColumnReference.kind, (expr) => this.visitColumnReference(expr as ColumnReference));
        this.handlers.set(FunctionCall.kind, (expr) => this.visitFunctionCall(expr as FunctionCall));
        this.handlers.set(UnaryExpression.kind, (expr) => this.visitUnaryExpression(expr as UnaryExpression));
        this.handlers.set(BinaryExpression.kind, (expr) => this.visitBinaryExpression(expr as BinaryExpression));
        this.handlers.set(ParameterExpression.kind, (expr) => this.visitParameterExpression(expr as ParameterExpression));
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectExpression(expr as SelectItem));
        this.handlers.set(ArrayExpression.kind, (expr) => this.visitArrayExpression(expr as ArrayExpression));
        this.handlers.set(CaseExpression.kind, (expr) => this.visitCaseExpression(expr as CaseExpression));
        this.handlers.set(CastExpression.kind, (expr) => this.visitCastExpression(expr as CastExpression));
        this.handlers.set(ParenExpression.kind, (expr) => this.visitBracketExpression(expr as ParenExpression));
        this.handlers.set(BetweenExpression.kind, (expr) => this.visitBetweenExpression(expr as BetweenExpression));
        this.handlers.set(TypeValue.kind, (expr) => this.visitTypeValue(expr as TypeValue));
        this.handlers.set(InlineQuery.kind, (expr) => this.visitInlineQuery(expr as InlineQuery));

        // source alias
        this.handlers.set(SourceAliasExpression.kind, (expr) => this.visitSourceAliasExpression(expr as SourceAliasExpression));

        // from
        this.handlers.set(FromClause.kind, (expr) => this.visitFromClause(expr as FromClause));
        this.handlers.set(JoinClause.kind, (expr) => this.visitJoinClause(expr as JoinClause));
        this.handlers.set(JoinOnClause.kind, (expr) => this.visitJoinOnClause(expr as JoinOnClause));
        this.handlers.set(JoinUsingClause.kind, (expr) => this.visitJoinUsingClause(expr as JoinUsingClause));

        this.handlers.set(SourceExpression.kind, (expr) => this.visitSourceExpression(expr as SourceExpression));
        this.handlers.set(SubQuerySource.kind, (expr) => this.visitSubQuerySource(expr as SubQuerySource));
        this.handlers.set(FunctionSource.kind, (expr) => this.visitFunctionSource(expr as FunctionSource));
        this.handlers.set(TableSource.kind, (expr) => this.visitTableSource(expr as TableSource));

        // order by
        this.handlers.set(OrderByClause.kind, (expr) => this.visitOrderByClause(expr as OrderByClause));
        this.handlers.set(OrderByItem.kind, (expr) => this.visitOrderByItem(expr as OrderByItem));

        // partition by
        this.handlers.set(PartitionByClause.kind, (expr) => this.visitPartitionByClause(expr as PartitionByClause));

        // window frame
        this.handlers.set(WindowFrameExpression.kind, (expr) => this.visitWindowFrameExpression(expr as WindowFrameExpression));
        this.handlers.set(WindowFrameSpec.kind, (arg) => this.visitWindowFrameSpec(arg));
        this.handlers.set(WindowFrameBoundStatic.kind, (arg) => this.visitWindowFrameBoundStatic(arg as WindowFrameBoundStatic));
        this.handlers.set(WindowFrameBoundaryValue.kind, (arg) => this.visitWindowFrameBoundaryValue(arg as WindowFrameBoundaryValue));
        this.handlers.set(WindowFrameClause.kind, (arg) => this.visitWindowFrameClause(arg as WindowFrameClause));
        // where
        this.handlers.set(WhereClause.kind, (expr) => this.visitWhereClause(expr as WhereClause));

        // group by
        this.handlers.set(GroupByClause.kind, (expr) => this.visitGroupByClause(expr as GroupByClause));
        this.handlers.set(HavingClause.kind, (expr) => this.visitHavingClause(expr as HavingClause));

        // with
        this.handlers.set(CommonTable.kind, (expr) => this.visitCommonTable(expr as CommonTable));
        this.handlers.set(WithClause.kind, (expr) => this.visitWithClause(expr as WithClause));

        // select
        this.handlers.set(SelectItem.kind, (expr) => this.visitSelectExpression(expr as SelectItem));
        this.handlers.set(SelectClause.kind, (expr) => this.visitSelectClause(expr as SelectClause));
        this.handlers.set(Distinct.kind, (expr) => this.visitDistinct(expr as Distinct));
        this.handlers.set(DistinctOn.kind, (expr) => this.visitDistinctOn(expr as DistinctOn));

        // row limit
        this.handlers.set(LimitClause.kind, (expr) => this.visitLimitClause(expr as LimitClause));
        this.handlers.set(FetchSpecification.kind, (expr) => this.visitFetchSpecification(expr as FetchSpecification));

        // for clause
        this.handlers.set(ForClause.kind, (expr) => this.visitForClause(expr as ForClause));

        // values clause
        this.handlers.set(ValuesQuery.kind, (expr) => this.visitValuesQuery(expr as ValuesQuery));
        this.handlers.set(TupleExpression.kind, (expr) => this.visitTupleExpression(expr as TupleExpression));

        // select query
        this.handlers.set(SimpleSelectQuery.kind, (expr) => this.visitSelectQuery(expr as SimpleSelectQuery));
        this.handlers.set(BinarySelectQuery.kind, (expr) => this.visitBinarySelectQuery(expr as BinarySelectQuery));
    }

    /**
     * Formats the given SQL AST node into a SQL string.
     * This is the recommended public API for users.
     * @param arg The root SQL AST node to format.
     * @param config (Optional) Formatter configuration.
     * @returns The formatted SQL string.
     */
    public format(arg: SqlComponent, config: FormatterConfig | null = null): string {
        if (config) {
            this.config = config;
        }
        return this.visit(arg);
    }

    /**
     * Visitor entry point for SQL AST nodes.
     * Note: This method is public only for interface compatibility.
     *       Users should call the format() method instead of visit() directly.
     *       (If you call visit() directly, you are basically breaking the abstraction, so don't do it!)
     * @param arg The SQL AST node to visit.
     * @returns The formatted SQL string for the node.
     */
    public visit(arg: SqlComponent): string {
        const handler = this.handlers.get(arg.getKind());
        if (handler) {
            return handler(arg);
        }

        // Provide more detailed error message
        const kindSymbol = arg.getKind()?.toString() || 'unknown';
        const constructor = arg.constructor?.name || 'unknown';
        throw new Error(`No handler for ${constructor} with kind ${kindSymbol}. Consider adding a handler for this type.`);
    }

    private visitBinarySelectQuery(arg: BinarySelectQuery): string {
        const left = arg.left.accept(this);
        const operator = arg.operator.accept(this);
        const right = arg.right.accept(this);
        return `${left} ${operator} ${right}`;
    }

    private visitWindowFrameBoundaryValue(arg: WindowFrameBoundaryValue): string {
        const value = arg.value.accept(this);
        const following = arg.isFollowing ? "following" : "preceding";
        return `${value} ${following}`;
    }

    private visitWindowFrameBoundStatic(arg: WindowFrameBoundStatic): string {
        switch (arg.bound) {
            case WindowFrameBound.UnboundedPreceding:
                return "unbounded preceding";
            case WindowFrameBound.CurrentRow:
                return "current row";
            case WindowFrameBound.UnboundedFollowing:
                return "unbounded following";
            default:
                throw new Error(`Unknown WindowFrameBound: ${arg.bound}`);
        }
    }

    private visitWindowFrameExpression(arg: WindowFrameExpression): string {
        const partitionBy = arg.partition !== null ? arg.partition.accept(this) : null;
        const orderBy = arg.order !== null ? arg.order.accept(this) : null;
        const frameSpec = arg.frameSpec !== null ? arg.frameSpec.accept(this) : null;

        const parts: string[] = [];
        if (partitionBy) parts.push(partitionBy);
        if (orderBy) parts.push(orderBy);
        if (frameSpec) parts.push(frameSpec);

        if (parts.length > 0) {
            return `(${parts.join(" ")})`;
        }
        return `()`;
    }

    private visitWindowFrameSpec(arg: WindowFrameSpec): string {
        const frameType = arg.frameType;
        const startBound = arg.startBound.accept(this);

        if (arg.endBound === null) {
            return `${frameType} ${startBound}`;
        } else {
            const endBound = arg.endBound.accept(this);
            return `${frameType} between ${startBound} and ${endBound}`;
        }
    }

    private visitJoinUsingClause(arg: JoinUsingClause): string {
        return `using (${arg.condition.accept(this)})`;
    }

    private visitJoinOnClause(arg: JoinOnClause): string {
        if (arg.condition !== null) {
            return `on ${arg.condition.accept(this)}`;
        }
        return `on`;
    }

    private visitTypeValue(arg: TypeValue): string {
        if (arg.argument !== null) {
            return `${arg.type.accept(this)}(${arg.argument.accept(this)})`;
        }
        return `${arg.type.accept(this)}`;
    }

    private visitStringSpecifierExpression(arg: StringSpecifierExpression): string {
        return `${arg.specifier.accept(this)}${arg.value.accept(this)}`;
    }

    private visitWithClause(arg: WithClause): string {
        const part = arg.tables.map((e) => e.accept(this)).join(", ");
        if (arg.recursive) {
            return `with recursive ${part}`;
        }
        return `with ${part}`;
    }

    private visitCommonTable(arg: CommonTable): string {
        const alias = arg.aliasExpression.accept(this);
        const materil = arg.materialized === null
            ? ''
            : arg.materialized ? 'materialized' : 'not materialized';

        if (alias && materil) {
            return `${alias} ${materil} as (${arg.query.accept(this)})`;
        }
        return `${alias} as (${arg.query.accept(this)})`;
    }

    private visitDistinctOn(arg: DistinctOn): string {
        return `distinct on(${arg.value.accept(this)})`;
    }

    private visitDistinct(arg: Distinct): string {
        return `distinct`;
    }

    private visitHavingClause(arg: HavingClause): string {
        return `having ${arg.condition.accept(this)}`;
    }

    private visitGroupByClause(arg: GroupByClause): string {
        const part = arg.grouping.map((e) => e.accept(this)).join(", ");
        return `group by ${part}`;
    }

    private visitFromClause(arg: FromClause): string {
        if (arg.joins !== null && arg.joins.length > 0) {
            const part = arg.joins.map((e) => e.accept(this)).join(" ");
            return `from ${arg.source.accept(this)} ${part}`;
        }
        return `from ${arg.source.accept(this)}`;
    }

    private visitJoinClause(arg: JoinClause): string {
        const joinType = `${arg.joinType.accept(this)}`;
        const lateral = arg.lateral === true ? ` lateral` : "";
        const joinSource = arg.source.accept(this);
        const condition = arg.condition !== null ? ` ${arg.condition.accept(this)}` : "";
        return `${joinType}${lateral} ${joinSource}${condition}`;
    }

    private visitSourceAliasExpression(arg: SourceAliasExpression): string {
        const columnAlias = arg.columns !== null ? `(${arg.columns.map((e) => e.accept(this)).join(", ")})` : null;
        const tableAlias = arg.table !== null ? `${arg.table.accept(this)}` : "";

        if (columnAlias && tableAlias) {
            return `${tableAlias}${columnAlias}`;
        }
        if (tableAlias) {
            return tableAlias;
        }
        throw new Error("Invalid SourceAliasExpression: tableAlias is null");
    }

    private visitSourceExpression(arg: SourceExpression): string {
        let alias = arg.aliasExpression !== null ? `${arg.aliasExpression.accept(this)}` : "";

        // Avoid duplicate alias if the name is the same as the alias
        if (arg.datasource instanceof TableSource) {
            if (arg.aliasExpression !== null && arg.datasource.identifier !== null && arg.datasource.identifier.accept(this) === arg.aliasExpression.accept(this)) {
                alias = "";
            }
        }

        if (alias) {
            return `${arg.datasource.accept(this)} as ${alias}`;
        }
        return `${arg.datasource.accept(this)}`;
    }

    private visitSubQuerySource(arg: SubQuerySource): string {
        return `(${arg.query.accept(this)})`;
    }

    private visitFunctionSource(arg: FunctionSource): string {
        if (arg.argument !== null) {
            return `${arg.name.accept(this)}(${arg.argument.accept(this)})`;
        }
        return `${arg.name.accept(this)}()`;
    }

    private visitTableSource(arg: TableSource): string {
        if (arg.namespaces !== null) {
            return `${arg.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${arg.table.accept(this)}`;
        }
        return `${arg.table.accept(this)}`;
    }

    private visitValueList(arg: ValueList): string {
        return `${arg.values.map((v) => v.accept(this)).join(", ")}`;
    }

    private visitSwitchCaseArgument(arg: SwitchCaseArgument): string {
        const casePart = arg.cases.map((kv: CaseKeyValuePair) => `when ${kv.key.accept(this)} then ${kv.value.accept(this)}`).join(" ");
        const elsePart = arg.elseValue ? ` else ${arg.elseValue.accept(this)}` : "";
        return `${casePart}${elsePart}`;
    }

    private visitColumnReference(arg: ColumnReference): string {
        if (arg.namespaces != null) {
            return `${arg.namespaces.map((ns) => `${ns.accept(this)}`).join(".")}.${arg.column.accept(this)}`;
        }
        return `${arg.column.accept(this)}`;
    }

    private visitFunctionCall(arg: FunctionCall): string {
        const partArg = arg.argument !== null ? arg.argument.accept(this) : "";

        if (arg.over === null) {
            return `${arg.name.accept(this)}(${partArg})`;
        } else {
            let partOver = arg.over !== null ? `${arg.over.accept(this)}` : "";
            if (partOver) {
                if (partOver.startsWith("(")) {
                    partOver = ` over${partOver}`;
                } else {
                    partOver = ` over ${partOver}`;
                }
            }
            return `${arg.name.accept(this)}(${partArg})${partOver}`;
        }
    }

    private visitUnaryExpression(arg: UnaryExpression): string {
        return `${arg.operator.accept(this)} ${arg.expression.accept(this)}`;
    }

    private visitBinaryExpression(arg: BinaryExpression): string {
        return `${arg.left.accept(this)} ${arg.operator.accept(this)} ${arg.right.accept(this)}`;
    }

    private visitLiteralExpression(arg: LiteralValue): string {
        if (typeof arg.value === "string") {
            return `'${arg.value.replace(/'/g, "''")}'`;
        } else if (arg.value === null) {
            return "null";
        }
        return arg.value.toString();
    }

    private visitParameterExpression(arg: ParameterExpression): string {
        return `${this.config.parameterSymbol}${arg.name.accept(this)}`;
    }

    private visitSelectExpression(arg: SelectItem): string {
        if (arg.identifier !== null) {
            if (arg.value instanceof ColumnReference) {
                const c = arg.value as ColumnReference;
                if (c.column.name === arg.identifier.name) {
                    return `${arg.value.accept(this)}`;
                } else {
                    return `${arg.value.accept(this)} as ${arg.identifier.accept(this)}`;
                }
            }
            return `${arg.value.accept(this)} as ${arg.identifier.accept(this)}`;
        }
        return arg.value.accept(this);
    }

    private visitSelectClause(arg: SelectClause): string {
        const distinct = arg.distinct !== null ? " " + arg.distinct.accept(this) : "";
        const colum = arg.items.map((e) => e.accept(this)).join(", ");
        return `select${distinct} ${colum}`;
    }

    private visitSelectQuery(arg: SimpleSelectQuery): string {
        const parts: string[] = [];

        // WITH
        if (arg.WithClause !== null) {
            parts.push(arg.WithClause.accept(this));
        }

        parts.push(arg.selectClause.accept(this));

        if (arg.fromClause !== null) {
            parts.push(arg.fromClause.accept(this));
        }

        if (arg.whereClause !== null) {
            parts.push(arg.whereClause.accept(this));
        }

        if (arg.groupByClause !== null) {
            parts.push(arg.groupByClause.accept(this));
        }

        if (arg.havingClause !== null) {
            parts.push(arg.havingClause.accept(this));
        }

        if (arg.windowFrameClause !== null) {
            parts.push(arg.windowFrameClause.accept(this));
        }

        if (arg.orderByClause !== null) {
            parts.push(arg.orderByClause.accept(this));
        }

        if (arg.rowLimitClause !== null) {
            parts.push(arg.rowLimitClause.accept(this));
        }

        if (arg.forClause !== null) {
            parts.push(arg.forClause.accept(this));
        }

        return parts.join(" ");
    }

    private visitArrayExpression(arg: ArrayExpression): string {
        return `array[${arg.expression.accept(this)}]`;
    }

    private visitCaseExpression(arg: CaseExpression): string {
        if (arg.condition !== null) {
            return `case ${arg.condition.accept(this)} ${arg.switchCase.accept(this)} end`;
        }
        return `case ${arg.switchCase.accept(this)} end`;
    }

    private visitCastExpression(arg: CastExpression): string {
        return `${arg.input.accept(this)}::${arg.castType.accept(this)}`;
    }

    private visitBracketExpression(arg: ParenExpression): string {
        return `(${arg.expression.accept(this)})`;
    }

    private visitBetweenExpression(arg: BetweenExpression): string {
        if (arg.negated) {
            return `${arg.expression.accept(this)} not between ${arg.lower.accept(this)} and ${arg.upper.accept(this)}`;
        }
        return `${arg.expression.accept(this)} between ${arg.lower.accept(this)} and ${arg.upper.accept(this)}`;
    }

    private visitPartitionByClause(arg: PartitionByClause): string {
        return `partition by ${arg.value.accept(this)}`;
    }

    private visitOrderByClause(arg: OrderByClause): string {
        const part = arg.order.map((e) => e.accept(this)).join(", ");
        return `order by ${part}`;
    }

    private visitOrderByItem(arg: OrderByItem): string {
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

    private visitWindowFrameClause(arg: WindowFrameClause): string {
        const partExpr = arg.expression.accept(this);
        return `window ${arg.name.accept(this)} as ${partExpr}`;
    }

    private visitLimitClause(arg: LimitClause): string {
        if (arg.offset !== null) {
            return `limit ${arg.limit.accept(this)} offset ${arg.offset.accept(this)}`;
        }
        return `limit ${arg.limit.accept(this)}`;
    }

    private visitFetchSpecification(arg: FetchSpecification): string {
        const type = arg.type === FetchType.First ? 'first' : 'next';
        const count = arg.count.accept(this);

        if (arg.unit !== null) {
            return `fetch ${type} ${count} ${arg.unit}`;
        }
        return `fetch ${type} ${count}`;
    }

    private visitForClause(arg: ForClause): string {
        return `for ${arg.lockMode}`;
    }

    private visitWhereClause(arg: WhereClause): string {
        return `where ${arg.condition.accept(this)}`;
    }

    private visitInlineQuery(arg: InlineQuery): string {
        return `(${arg.selectQuery.accept(this)})`;
    }

    private visitRawString(arg: RawString): string {
        const invalidChars = new Set(["'", '"', ",", ";", ":", ".", "--", "/*"]);
        if (invalidChars.has(arg.value)) {
            throw new Error(`invalid keyword: ${arg.value} `);
        } else if (arg.value.trim() === "") {
            throw new Error("invalid keyword: empty string");
        }
        return arg.value.trim();
    }

    private visitIdentifierString(arg: IdentifierString): string {
        // No need to escape wildcards
        if (arg.name === '*') {
            return arg.name;
        }
        return `${this.config.identifierEscape.start}${arg.name}${this.config.identifierEscape.end}`;
    }

    private visitValuesQuery(arg: ValuesQuery): string {
        const tuples = arg.tuples.map((tuple) => tuple.accept(this)).join(", ");
        return `values ${tuples}`;
    }

    private visitTupleExpression(arg: TupleExpression): string {
        const values = arg.values.map((value) => value.accept(this)).join(", ");
        return `(${values})`;
    }
}