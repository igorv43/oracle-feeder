import fetch from 'lib/fetch'
import { errorHandler } from 'lib/error'
import * as logger from 'lib/logger'
import { Quoter } from 'provider/base'
import * as _ from 'lodash'
import { num } from 'lib/num'

type Response = Array<{ symbol: string; price: string }> | { msg: string; code: number }

export class TerraClassic extends Quoter {
  private async updatePrices(): Promise<void> {
    const symbols = this.symbols
    const response: Response = await fetch(`http://localhost:5000/coin/findToDenom/?symbols=[${symbols}]`, {
      timeout: this.options.timeout,
    }).then((res) => res.json())

    if (!_.isArray(response)) {
      logger.error(`${this.constructor.name}:`, response.msg)
      throw new Error('Invalid response from Terra Classic')
    }

    for (const crypto of response) {
      const symbol = this.symbols.find((symbol) => symbol === crypto.symbol)

      if (symbol) {
        this.setPrice(symbol, num(crypto.price))
      }
    }
  }

  protected async update(): Promise<boolean> {
    await this.updatePrices().catch(errorHandler)

    return true
  }
}

export default TerraClassic
