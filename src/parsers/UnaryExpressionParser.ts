import { Lexeme, TokenType } from "../models/Lexeme";
import { IdentifierString, UnaryExpression, ValueComponent } from "../models/ValueComponent";
import { ValueParser } from "./ValueParser";

export class UnaryExpressionParser {
    public static parse(lexemes: Lexeme[], index: number): { value: ValueComponent; newIndex: number } {
        let idx = index;

        // Process unary operator
        if (idx < lexemes.length && lexemes[idx].type === TokenType.Operator) {
            const operator = lexemes[idx].value;
            idx++;

            // Treat the asterisk as an Identifier, not as a unary operator
            if (operator === '*') {
                const v = new IdentifierString('*');
                return { value: v, newIndex: idx };
            }

            // Get the right-hand side value of the unary operator
            const result = ValueParser.parse(lexemes, idx);
            idx = result.newIndex;

            // Create unary expression
            const value = new UnaryExpression(operator, result.value);
            return { value, newIndex: idx };
        }

        throw new Error(`Invalid unary expression at index ${index}: ${lexemes[index].value}`);
    }
}