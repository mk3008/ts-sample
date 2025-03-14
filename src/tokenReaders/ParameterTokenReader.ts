﻿import { BaseTokenReader } from './BaseTokenReader';
import { TokenType } from '../enums/tokenType';
import { Lexeme } from '../models/Lexeme';
import { CharLookupTable } from '../utils/charLookupTable';

/**
 * Reads SQL parameter tokens (@param, :param, $param, ?)
 */
export class ParameterTokenReader extends BaseTokenReader {
    /**
     * Try to read a parameter token
     */
    public tryRead(previous: Lexeme | null): Lexeme | null {
        if (this.isEndOfInput()) {
            return null;
        }

        const char = this.input[this.position];

        // named parameter (@param, :param, $param)
        if (CharLookupTable.isNamedParameterPrefix(char)) {
            this.position++;

            // Read the identifier part after the prefix
            const start = this.position;
            while (this.canRead() && !CharLookupTable.isDelimiter(this.input[this.position])) {
                this.position++;
            }

            const identifier = this.input.slice(start, this.position);
            return this.createLexeme(TokenType.Parameter, char + identifier);
        }

        // nameless parameter (?)
        if (char === '?') {
            this.position++;
            return this.createLexeme(TokenType.Parameter, char);
        }

        return null;
    }
}
