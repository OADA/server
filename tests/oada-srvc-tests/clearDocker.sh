echo "----------------------"
echo "Stopping containers..."
echo ""
docker stop $(docker ps -aq)
echo "----------------------"
echo "Removing containers..."
echo ""
docker rm $(docker ps -aq)
echo "----------------------"
echo "Removing volumes..."
echo ""
docker volume rm $(docker volume ls -q)
echo "----------------------"
echo "Done! Press any key to exit."
echo "----------------------"
read -n1 -r -p "" key
