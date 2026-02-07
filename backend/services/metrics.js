function computeTradingMetrics(transactions){
    if(!Array.isArray(transactions) || transactions.length === 0){
        return {
            tradeFrequency: {perWeek: 0, perMonth: 0},
            avgTradeSize: 0,
            tradeSizeStdDev: 0,
            pctTradesAfterLoss: 0,
            avgHoldingPeriod: 0,
        }
    }

    //sort the transactions by date to make the time based metrics more consitent
    const sorted = [...transactions].sort((a,b) => new Date(a.order_date) - new Date(b.order_date));

    //Trade frequency = number of trades per week / month over the observed span
    const firstDate = new Date(sorted[0].order_date);
    const lastDate = new Date(sorted[sorted.length - 1].order_date);
    const daysSpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24)); 
    const weekSpan = daysSpan / 7
    const monthSpan = daysSpan / 30;
    const tradeFrequency = {
        perWeek: sorted.length / weekSpan,
        perMonth: sorted.length / monthSpan,
    };
    
    //Average trade size: mean of absolute cash value per trade.
    const cashValues = sorted.map((t) => Math.abs(Number(t.cash_cad || 0))); 
    const avgTradeSize = cashValues.reduce((sum, v) => sum + v, 0) / cashValues.length;

    //Trade size variability: standard deviation of absolute cash values
    const mean = avgTradeSize; 
    const variance = cashValues.reduce((sum, v) => sum + (v - mean) ** 2, 0) / cashValues.length; 
    const tradeSizeStdDev = Math.sqrt(variance);

    //% trades immediately after a loss\
    let afterLossCount = 0;
    for (let i = 1; i < sorted.length; i++){
        const prev = Number(sorted[i-1].cash_cad || 0);
        if (prev < 0) afterLossCount++;
    }
    const pctTradesAfterLoss = afterLossCount / (sorted.length - 1)*100;

    //Average holding period: first in first out match buys (cash_cad < 0) and sells (cash_cad > 0) by symbol)
    const buyQueues = new Map(); 
    const holdingPeriods = [];

    for (const t of sorted) {
        const symbol = t.symbol;
        const qty = Number(t.quantity || 0);
        const date = new Date(t.order_date);
        const cash = Number(t.cash_cad || 0);

        if (!buyQueues.has(symbol)) buyQueues.set(symbol, []);

        if (cash < 0) {
        // Buy: push into FIFO queue
        buyQueues.get(symbol).push({ date, qtyRemaining: qty });
        } else if (cash > 0) {
        // Sell: match against FIFO buys
        let qtyToClose = qty;
        const queue = buyQueues.get(symbol);

        while (qtyToClose > 0 && queue.length > 0) {
            const lot = queue[0];
            const used = Math.min(qtyToClose, lot.qtyRemaining);

            // Compute holding period in days
            const daysHeld = (date - lot.date) / (1000 * 60 * 60 * 24);
            holdingPeriods.push(daysHeld);

            // Reduce buy lot and remaining sell quantity
            lot.qtyRemaining -= used;
            qtyToClose -= used;

            if (lot.qtyRemaining <= 0) queue.shift(); // remove fully used lots
        }
        }
    }

    const avgHoldingPeriod =
        holdingPeriods.length > 0
        ? holdingPeriods.reduce((sum, v) => sum + v, 0) / holdingPeriods.length
        : 0;

    return {
        tradeFrequency,
        avgTradeSize,
        tradeSizeStdDev,
        pctTradesAfterLoss,
        avgHoldingPeriod,
    };
}

module.exports = { computeTradingMetrics };