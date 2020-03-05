rm -rf abi
cd ../protocol
truffle compile
cd ../lib
cp -rf ../protocol/build/contracts abi