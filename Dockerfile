FROM node:latest
WORKDIR /code
RUN git clone https://github.com/kellyshang/cota-sdk-js-test.git \
  && cd cota-sdk-js-test \
  && npm i \
  && npm install -g mochawesome-report-generator \
  && sed -i 's@http://localhost:3050@https://cota.nervina.dev/registry-aggregator@g' ./utils/url.js \
  && sed -i 's@http://localhost:3030@https://cota.nervina.dev/aggregator@g' ./utils/url.js \
  && sed -i 's@http://localhost:8114@https://testnet.ckbapp.dev/rpc@g' ./utils/url.js \
  && sed -i 's@http://localhost:8116@https://testnet.ckbapp.dev/indexer@g' ./utils/url.js 
