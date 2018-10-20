
declare var Papa: any;

const FIELD_DATE_STR = "fecha";
const FIELD_HOUR_STR = "hora";
const FIELD_PRODUCT_STR = "producto";
const FIELD_ID_STR = "isin";
const FIELD_NUM_STR = "titulos";
const FIELD_PRICE_STR = "precio";
const FIELD_TOTAL_STR = "total";

const EXPECTED_FIELDS = [
    FIELD_DATE_STR,
    FIELD_HOUR_STR,
    FIELD_PRODUCT_STR,
    FIELD_ID_STR,
    FIELD_NUM_STR,
    FIELD_PRICE_STR,
    FIELD_TOTAL_STR
];

enum TransactionType {
    BUY,
    SELL
}


class StockTransactionsProcessor {

    public processFile(file: File) {
        var self = this;

        Papa.parse(file, {
            delimiter: "|",
            header: true,
            skipEmptyLines: true,
            complete: function(result, file) {
                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                console.log("Processing " + file.name + "...");
                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                self.processCsvResult(result, file);
                console.log(file.name + " succesful processed");
                console.log("<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n\n");
            },
            error: function errorFn(error, file) {
                throw new Error("Error while parsing "
                    + file.name + "(" + error + ")");
            }
        });
    }

    private checkParsing(csvResult, file) {
        var error = csvResult.errors[0]
        if (error) {
            throw new Error("Error while parsing "
                + file.name + "(" + JSON.stringify(error) + ")");
        }

        for (let field of EXPECTED_FIELDS) {
            if (csvResult.meta.fields.indexOf(field) == -1) {
                throw new Error("Field '" + field + "' not found");
            }
        }
    }

    private processCsvResult(csvResult, file) {
        this.checkParsing(csvResult, file);

        const format = "DD-MM-YYYY hh:mm";
        var prodoucts = {};

        for (let input of csvResult.data) {
            let dateStr = input.fecha + " " + input.hora;
            let date = parseDate(dateStr, format);
            if (isNaN(date.getTime())) {
                throw new Error("Invalid date: " + dateStr
                    + ". Expected format: " + format);
            }

            input.date = date;
            input.titulos = parseFloat(input.titulos);
            input.total = parseFloat(input.total);

            let product = prodoucts[input.isin];
            if (product == undefined) {
                product = {};
                product.name = input.producto;
                product.buys = [];
                product.sells = [];
                product.stocksRemaining = 0;
                prodoucts[input.isin] = product;
                product.buysTotal = 0;
                product.sellsTotal = 0;
            } else {
                if (input.date > product.prevDate) {
                    throw new Error("Not reversed dates (" +
                        input.date.toLocaleDateString() + " >= " +
                        product.prevDate.toLocaleDateString() + ")");
                }
                if (input.date == product.prevDate &&
                    input.type != product.prevType) {
                    throw new Error("Not reversed dates for same type (" +
                        input.date.toLocaleDateString() + " >= " +
                        product.prevDate.toLocaleDateString() + ")");
                }
            }

            product.prevDate = input.date;
            product.prevType = input.type;

            if (input.total <= 0) {
                input.type = TransactionType.BUY;
                input.total = Math.abs(input.total);
                input.titulos = Math.abs(input.titulos);
                product.stocksRemaining += input.titulos;
                product.buys.push(input);
                product.buysTotal += input.total;
            } else if (input.total > 0) {
                input.type = TransactionType.SELL;
                input.total = Math.abs(input.total);
                input.titulos = Math.abs(input.titulos);
                product.sells.push(input);
                product.sellsTotal += input.total;
            }
        }

        let stocksRemainingPeriod = 0;

        for (let isin in prodoucts) {
            let product = prodoucts[isin];

            var currentYear = 0;
            var buyTotalPeriod = 0;
            var sellTotalPeriod = 0;
            var gainTotal = 0;

            var buy = product.buys.pop();
            var stocksBuy = buy.titulos;
            stocksRemainingPeriod += stocksBuy;

            console.info(product.name, isin);

            for (let sell of product.sells.reverse()) {
                let year = sell.date.getFullYear();

                if (year > currentYear) {
                    console.info("TOTAL: ", sellTotalPeriod.toFixed(2), -buyTotalPeriod.toFixed(2),
                        (sellTotalPeriod - buyTotalPeriod).toFixed(2));
                    console.info("");
                    console.info(year);

                    currentYear = year;
                    buyTotalPeriod = 0;
                    sellTotalPeriod = 0;
                }

                console.info(sell.date.toLocaleDateString(), sell.titulos, sell.total);

                sellTotalPeriod += sell.total;

                let stocksSell = sell.titulos;
                let buyTotal = 0;
                let maxIterations = 100;

                do {
                    let stocksToConsume = Math.min(stocksBuy, stocksSell);
                    product.stocksRemaining -= stocksToConsume;
                    stocksRemainingPeriod -= stocksToConsume;
                    stocksBuy -= stocksToConsume;
                    stocksSell -= stocksToConsume;

                    let buyToConsume = (stocksToConsume * buy.total) / buy.titulos;
                    buyTotal += buyToConsume;
                    let sellToConsume = (stocksToConsume * sell.total) / sell.titulos;
                    let gain = sellToConsume - buyToConsume;
                    gainTotal += gain;

                    console.info("\t", buy.date.toLocaleDateString(), stocksToConsume,
                        -buyToConsume.toFixed(2), sellToConsume.toFixed(2), gain.toFixed(2));

                    if (stocksBuy == 0) {
                        if (product.buys === undefined || product.buys.length == 0) {
                            if (product.stocksRemaining > 0) {
                                throw new Error("Not enough buys");
                            }

                            console.info("Cartera vacia");
                            break;
                        }

                        buy = product.buys.pop();
                        stocksBuy = buy.titulos;

                        if (sell.date > buy.date) {
                            stocksRemainingPeriod += stocksBuy;
                        }
                    }

                    maxIterations--;
                } while (stocksSell > 0 && maxIterations > 0);

                if (maxIterations == 0) {
                    throw new Error("Max iterations reached");
                }

                console.info("\t", stocksRemainingPeriod, sell.total.toFixed(2),
                    -buyTotal.toFixed(2), (sell.total - buyTotal).toFixed(2), gainTotal.toFixed(2));

                if (sell.date < buy.date) {
                    stocksRemainingPeriod += stocksBuy;
                }

                buyTotalPeriod += buyTotal;
            }

            console.info("TOTAL: ", sellTotalPeriod.toFixed(2), -buyTotalPeriod.toFixed(2),
                (sellTotalPeriod - buyTotalPeriod).toFixed(2));

            var finalValue = product.buysTotal - product.sellsTotal;
            var stockPrice = finalValue / product.stocksRemaining;

            console.info("");
            console.info("Titulos en cartera: " + product.stocksRemaining);
            console.info("total compras: " + product.buysTotal.toFixed(2),
                ", total ventas: " + product.sellsTotal.toFixed(2),
                ", valor cartera: ", finalValue.toFixed(2),
                ", precio accion: ", stockPrice.toFixed(2));
            console.info("");
        }
    }

}
