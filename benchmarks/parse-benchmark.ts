import * as Benchmark from 'benchmark';
import * as os from 'os';
import { DefaultFormatter } from '../src/models/DefaultFormatter';
import { SelectQueryParser } from '../src/parsers/SelectQueryParser';

// Set of SQL queries for benchmarking
const queries = [
    {
        name: 'carbunqlex-ts Tokens20',
        sql: `SELECT id, name, email, age, created_at, updated_at, status, role, last_login, country
              FROM users
              WHERE id = 1;`
    },
    {
        name: 'carbunqlex-ts Tokens70',
        sql: `SELECT
                u.id, u.name, u.email, u.age, u.status, u.role,
                o.id AS order_id, o.total, o.order_date, o.status AS order_status
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              WHERE u.age > 1 AND o.status = 'completed'
              ORDER BY o.order_date DESC;`
    },
    {
        name: 'carbunqlex-ts Tokens140',
        sql: `WITH recent_orders AS (
                SELECT user_id, MAX(order_date) AS last_order
                FROM orders
                GROUP BY user_id
              )
              SELECT
                u.id, u.name, u.email, u.age, u.status, u.role, u.created_at, u.updated_at,
                r.last_order, SUM(o.total) AS total_spent
              FROM users AS u
              JOIN orders AS o ON u.id = o.user_id
              JOIN recent_orders AS r ON u.id = r.user_id
              WHERE u.status = 'active'
              GROUP BY u.id, u.name, u.email, u.age, u.status, u.role, u.created_at, u.updated_at, r.last_order
              HAVING SUM(o.total) > 10
              ORDER BY total_spent DESC;`
    },
    {
        name: 'carbunqlex-ts Tokens230',
        sql: `with
                detail as (
                    select
                        q.*,
                        trunc(q.price * (1 + q.tax_rate)) - q.price as tax,
                        q.price * (1 + q.tax_rate) - q.price as raw_tax
                    from
                        (
                            select
                                dat.*,
                                (dat.unit_price * dat.quantity) as price
                            from
                                dat
                        ) q
                ),
                tax_summary as (
                    select
                        d.tax_rate,
                        trunc(sum(raw_tax)) as total_tax
                    from
                        detail d
                    group by
                        d.tax_rate
                )
                select
                line_id,
                    name,
                    unit_price,
                    quantity,
                    tax_rate,
                    price,
                    price + tax as tax_included_price,
                    tax
                from
                    (
                        select
                            line_id,
                            name,
                            unit_price,
                            quantity,
                            tax_rate,
                            price,
                            tax + adjust_tax as tax
                        from
                            (
                                select
                                    q.*,
                                    case when q.total_tax - q.cumulative >= q.priority then 1 else 0 end as adjust_tax
                                from
                                    (
                                        select
                                            d.*,
                                            s.total_tax,
                                            sum(d.tax) over (partition by d.tax_rate) as cumulative,
                                            row_number() over (partition by d.tax_rate order by d.raw_tax % 1 desc, d.line_id) as priority
                                        from
                                            detail d
                                            inner join tax_summary s on d.tax_rate = s.tax_rate
                                    ) q
                            ) q
                    ) q
                order by
                    line_id`
    }
];

// Create formatter instance (use if needed)
const formatter = new DefaultFormatter();

// Create benchmark suite
const suite = new Benchmark.Suite;

// Create functions for testing
function parseAllQueries() {
    for (const query of queries) {
        SelectQueryParser.parseFromText(query.sql);
    }
}

function parseQuery(sql: string) {
    return () => {
        SelectQueryParser.parseFromText(sql);
    };
}

// Get system information
function getSystemInfo() {
    const cpus = os.cpus();
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown CPU';
    const cpuCount = cpus.length;
    const logicalCores = cpuCount;
    const osName = `${os.type()} ${os.release()}`;
    const totalMem = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    const nodeVersion = process.version;

    return {
        cpuModel,
        logicalCores,
        osName,
        totalMem,
        nodeVersion
    };
}

// Add benchmarks for individual queries
queries.forEach((query, index) => {
    // Set label using query name
    suite.add(`${query.name}`, parseQuery(query.sql));
});

// Function to display header and system information
function printHeader() {
    const info = getSystemInfo();
    const currentDate = new Date().toISOString().split('T')[0];

    console.log('```');
    console.log(`BenchmarkTS, ${info.osName}`);
    console.log(`${info.cpuModel}, ${info.logicalCores} logical cores`);
    console.log(`Node.js ${info.nodeVersion}`);
    console.log('```');
    console.log('');
}

// Display report in markdown table format
function printResults(results: any[]) {
    console.log('| Method                            | Mean       | Error     | StdDev    |');
    console.log('|---------------------------------- |-----------:|----------:|----------:|');

    results.forEach(result => {
        // Format name field (up to 30 characters)
        const name = result.name.padEnd(30).substring(0, 30);

        // Display average time in milliseconds (3 decimal places)
        const mean = (result.mean * 1000).toFixed(3).padStart(8);

        // Display error rate in milliseconds (4 decimal places)
        const error = ((result.stats.deviation * 1000) * 1.96).toFixed(4).padStart(7);

        // Display standard deviation in milliseconds (4 decimal places)
        const stddev = (result.stats.deviation * 1000).toFixed(4).padStart(7);

        console.log(`| ${name} | ${mean} ms | ${error} ms | ${stddev} ms |`);
    });
    console.log('')
}

// Callback when benchmark is completed
suite.on('cycle', (event: any) => {
    // Suppress log output for each cycle
});

// Callback on completion
suite.on('complete', function (this: any) {
    // Get results as an array
    const results = this.filter('successful').map((benchmark: any) => ({
        name: benchmark.name,
        hz: benchmark.hz,
        stats: benchmark.stats,
        rme: benchmark.stats.rme,
        mean: benchmark.stats.mean,
        samples: benchmark.stats.sample.length
    }));

    // Sort by execution time (ascending)
    const sortedByTime = [...results].sort((a: any, b: any) => a.mean - b.mean);

    // Display header and system information
    printHeader();

    // Display results in markdown table
    printResults(sortedByTime);
});

// Run benchmark
console.log('running...');
suite.run({ 'async': false });