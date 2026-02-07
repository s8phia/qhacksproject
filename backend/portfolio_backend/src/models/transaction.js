class Transaction {
  constructor(orderDate, settlementDate, symbol, quantity, priceCad, cashCad) {
    this.order_date = orderDate;
    this.settlement_date = settlementDate;
    this.symbol = symbol;
    this.quantity = quantity;
    this.price_cad = priceCad;
    this.cash_cad = cashCad;
  }
}

module.exports = Transaction;
